"use strict";

let moment = require( 'moment' );
let async = require( 'async' );
let sha1 = require( 'sha1' );

module.exports = function( app ) {
  
  function checkForErrors( res, body ) {
    if ( res.statusCode < 400 ) return null;
    let msg = res.statusMessage || body || res.responseText || 'unknown error';
    if ( typeof body == 'object' && body.result && body.result.message )
      msg = body.result.message;
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
      this.localId = Math.random().toString().slice(2);
      this.options.auth.localId = this.localId;
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
	this.sessionKey = body.session.sessionKey;
	this.sessionSecret = body.session.sessionSecret;
	this.refreshToken = body.session.refreshToken;
	cb( null, body );
      });
    }

    endSession( cb ) {
      let date = ivcsDate();
      let headers = {
	date: date,
	partnerId: this.hash( this.options.auth.partnerId, date ),
	sessionKey: this.sessionKey,
	sessionSecret: this.hash( this.sessionSecret, date ),
	localId: this.hash( this.localId, date ),
	'Content-Type': null
      };
      this.request({
	uri: '/session/',
	method: 'DELETE',
	headers: headers
      }, function( err, res, body ) {
	if ( err ) return cb( err );
	err = checkForErrors( res, body );
	if ( err ) return cb( err );
	cb( null, body );
      });
    }

    reloadSession( cb ) {
      let data = {
	partnerId: this.options.auth.partnerId,
	apiKey: this.options.auth.apiKey,
	localId: this.localId,
	refreshToken: this.refreshToken
      };
      this.request({
	uri: '/session/' + this.sessionKey + '/reload',
	method: 'POST',
	headers: { date: ivcsDate() },
	json: { session: data },
      }, ( err, res, body ) => {
	if ( err ) return cb( err );
	err = checkForErrors( res, body );
	if ( err ) return cb( err );
	this.sessionKey = body.session.sessionKey;
	this.sessionSecret = body.session.sessionSecret;
	this.refreshToken = body.session.refreshToken;
	cb( null, body );
      });
    }

    verifySession( cb ) {
      // this uses a different endpoint!!
      let DMS = this.options.endpoint.replace( /\/ivi$/, '/dms' ).replace( 'vcs', 'dms' );
      require( 'request' )({
	url: DMS + '/validate',
	method: 'GET',
	headers: this.getAuthHeaders()
      }, function( err, res, body ) {
	if ( err ) return cb( err );
	err = checkForErrors( res, body );
	return cb( err );
      });
    }

    // Get the headers to make a normal call
    getAuthHeaders() {
      let date = ivcsDate();
      let headers = {
	date: date,
	partnerId: this.hash( this.options.auth.partnerId, date ),
	sessionKey: this.sessionKey,
	sessionSecret: this.hash( this.sessionSecret, date ),
	localId: this.hash( this.localId, date )
      };
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
    authenticatedRequest( requestOptions, cb ) {
      async.waterfall([
	( cb ) => {
	  if ( this.sessionKey ) return process.nextTick(()=>{ cb( null, null ); });
	  if ( this.options.debug ) console.log( 'IVCS: Getting a session...' );
	  this.startSession( cb );
	},
	( result, cb ) => {
	  requestOptions.headers = this.getAuthHeaders();
	  if ( this.options.debug ) console.log( 'IVCS: Trying request...' );
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
	  this.reloadSession( (err) => {
	    if ( err ) return cb( err );
	    cb( null, result );
	  });
	},
	( result, cb ) => {
	  if ( result.good ) return process.nextTick(()=>{ cb( null, result ); });
	  requestOptions.headers = this.getAuthHeaders();
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
    login( userData, cb ) {
      this.authenticatedRequest({
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

    logout( userData, cb ) {
      this.authenticatedRequest({
	uri: '/customer/' + userData.id + '/logout',
	method: 'GET',
      }, cb );
    }

  }

  return Auth;
}

