"use strict";

let moment = require( 'moment' );
let async = require( 'async' );
let sha1 = require( 'sha1' );
let xml2js = require( 'xml2js' );

module.exports = function( app ) {
  
  function checkForErrors( res, body ) {
    if ( res.statusCode < 400 ) return null;
    let msg = res.statusMessage || body || res.responseText || 'unknown error';
    if ( typeof body == 'object' && body.result && body.result.message )
      msg = body.result.message;
    if ( typeof body == 'object' && body.response && body.response.message )
      msg = body.response.message;
    let err = new Error( msg );
    err.status = res.statusCode;
    return err;
  }

  function ivcsDate( m ) {
    let fmt = 'YYYY-MM-DD HH:mm:ss';
    if ( m ) return m.format( fmt );
    else return moment().format( fmt );
  }

  class Auth {

    constructor( options ) {
      this.options = options;
      this.request = require( 'request' ).defaults({
	baseUrl: this.options.endpoint,
      });

      if ( ! this.options.auth.localId )
	this.options.auth.localId = Math.random().toString().slice(2);

      // The caller can (and probably should) supply a function that will
      // get called with a new set of session data, if the functions in this
      // library happen to re-generate a session
      this.sessionRefreshed = this.options.sessionRefreshed || function( session ) {
	if ( this.options.debug ) {
	  console.log( 'session refreshed but no application handler specified' );
	}
      };
    }

    // used to clone this instance when doing OAuth
    getOptions() {
      return this.options;
    }

    // create the SHA1 has for the headers
    hash( value, date ) {
      return sha1( value.toString() + date.toString() );
    }

    startSession( cb ) {
      this.request({
	uri: '/session/',
	method: 'POST',
	headers: { date: ivcsDate() },
	json: { session: this.options.auth },
      }, ( err, res, body ) => {
	if ( err ) return cb( err );
	err = checkForErrors( res, body );
	if ( err ) return cb( err );
	if ( this.options.debug ) console.log( '=> session start:', body.session );
	cb( null, body.session );
      });
    }

    endSession( session, cb ) {
      let date = ivcsDate();
      if ( this.options.debug ) console.log( 'ending session:', session );
      let headers = {
	date: date,
	partnerId: this.hash( this.options.auth.partnerId, date ),
	sessionKey: session.sessionKey,
	sessionSecret: this.hash( session.sessionSecret, date ),
	localId: this.hash( this.options.auth.localId, date ),
	'Content-Type': null
      };
      this.request({
	uri: '/session/',
	method: 'DELETE',
	headers: headers
      }, ( err, res, body ) => {
	if ( err ) return cb( err );
	err = checkForErrors( res, body );
	if ( err ) return cb( err );
	if ( this.options.debug ) console.log( '=> session end:', session );
	cb( null, body );
      });
    }

    reloadSession( session, cb ) {
      let data = {
	partnerId: this.options.auth.partnerId,
	apiKey: this.options.auth.apiKey,
	localId: this.options.auth.localId,
	refreshToken: session.refreshToken
      };
      this.request({
	uri: '/session/' + session.sessionKey + '/reload',
	method: 'POST',
	headers: { date: ivcsDate() },
	json: { session: data },
      }, ( err, res, body ) => {
	if ( err ) return cb( err );
	err = checkForErrors( res, body );
	if ( err ) return cb( err );

	// notify the using client that the session has been refreshed!
	this.sessionRefreshed( body.session );
	
	cb( null, body.session );
      });
    }

    // "session" can be a existing session (with sessionKey, sessionSecret and localId) or already
    // prepared headers (same as above, but with the addition of dat and partnerId).
    verifySession( session, cb ) {
      // this uses a different endpoint!!
      //let DMS = this.options.endpoint.replace( /\/ivi$/, '/dms' ).replace( 'vcs', 'dms' );
      let DMS = this.options.endpoint; // OLD DMS ENDPOINT NO LONGER IN SERVICE
      require( 'request' )({
	url: DMS + '/validate',
	method: 'GET',
	headers: ( session.partnerId ? session : this.makeAuthHeaders( session ) )
      }, function( err, res, body ) {
	if ( err ) return cb( err );
	err = checkForErrors( res, body );
	if ( err ) return cb( err );
	// The body of this call always comes back as xml, darn it
	try {
	  xml2js.parseString( body, {explicitArray: false }, function( err, parsed ) {
	    return cb( err, parsed );
	  });
	} catch( err ) {
	  return cb( err );
	}
      });
    }

    // From the session info, make the auth headers
    makeAuthHeaders( session ) {
      let date = ivcsDate();
      let headers = {
	date: date,
	partnerId: this.hash( this.options.auth.partnerId, date ),
	sessionKey: session.sessionKey,
	sessionSecret: this.hash( session.sessionSecret, date ),
	localId: this.hash( this.options.auth.localId, date )
      };
      if ( this.options.debug ) console.log( 'makeAuthHeaders: from session:', session );
      return headers;
    }

    // Make an authenticated call
    //
    // if no sessionKey, get it
    // try function.  if success then done
    // if statusCode is 403 (or ?) then sessionReload (if that fails we're done)
    // try function.  if success then done
    // fail
    //
    authenticatedRequest( session, requestOptions, cb ) {
      async.waterfall([
	( cb ) => {
	  if ( session ) return process.nextTick(()=>{ cb( null, null ); });
	  if ( this.options.debug ) console.log( 'IVCS: Getting a session...' );
	  this.startSession( (err, newSession ) => {
	    if ( err ) return cb( err );
	    this.sessionRefreshed( newSession );
	    session = newSession;
	    cb( null, null );
	  });
	},
	( result, cb ) => {
	  requestOptions.headers = this.makeAuthHeaders( session );
	  if ( this.options.debug ) console.log( 'IVCS: Trying request...', requestOptions.uri||requestOptions.url );
	  this.request( requestOptions, ( err, res, body ) => {
	    // if ( this.options.debug ) console.log( 'IVCS: code:', res.statusCode, 'm:', res.statusMessahe, 'body:', body );
	    if ( err ) return cb( err );
	    if ( res.statusCode >= 200 && res.statusCode < 400 ) {
	      // we're good
	      if ( this.options.debug ) console.log( 'IVCS:  request is good!' );
	      return cb( null, { status: res.statusCode, res: res, body: body, good: true });
	    }
	    else {
	      // if the code is 403, then we'll try refreshing the session
	      // otherwise it was authenticated but returned an error
	      if ( res.statusCode == 403 ) {
		if ( this.options.debug ) console.log( 'IVCS:  request returned a 403' );
		return cb( null, { status: res.statusCode, res: res, body: body });
	      }
	      else {
		//let err = new Error( res.statusMessage || body || res.responseText || 'unknown error' );
		//err.status = res.statusCode;
		let err = checkForErrors( res, body );
		if ( this.options.debug ) console.log( 'IVCS:  request failed:', err );
		return cb( err );
	      }
	    }
	  });
	},
	( result, cb ) => {
	  if ( result.status != 403 ) return process.nextTick(()=>{ cb( null, result ); });
	  if ( this.options.debug ) console.log( 'IVCS: Refreshing session...' );
	  this.reloadSession( session, (err) => {
	    if ( err ) return cb( err );
	    cb( null, result );
	  });
	},
	( result, cb ) => {
	  if ( result.good ) return process.nextTick(()=>{ cb( null, result ); });
	  requestOptions.headers = this.makeAuthHeaders( session );
	  if ( this.options.debug ) console.log( 'IVCS: Retrying request...' );
	  this.request( requestOptions, ( err, res, body ) => {
	    if ( err ) return cb( err );
	    err = checkForErrors( res, body );
	    if ( err ) return cb( err );
	    cb( null, { status: res.statusCode, res: res, body: body });
	  });
	},
      ], ( err, result ) => {
	if ( err ) return cb( err );
	err = checkForErrors( result.res, result.body );
	if ( err ) return cb( err );
	cb( null, result.body );
      });
    }

    // returns: { name: 'Andrew', status: 'success', id: '1002eFAwAml2blM6' }
    login( session, userData, cb ) {
      this.authenticatedRequest( session, {
	uri: '/customer/login/',
	method: 'POST',
	json: {
	  login: {
	    email: userData.email,
	    password: userData.password,
	    clientId: this.options.clientId,
	    clientName: this.options.clientName
	  }
	}
      }, (err, res ) => {
	if ( err ) return cb( err );
	cb( null, res.result );
      });
    }

    logout( session, userData, cb ) {
      this.authenticatedRequest( session, {
	uri: '/customer/' + userData.id + '/logout',
	method: 'GET',
      }, cb );
      // logout has ended the session for us.
    }

  }

  return Auth;
}

