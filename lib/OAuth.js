"use strict";

let Tokens = require( './token' );

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

  class OAuth {
    constructor( options ) {
      this.options = options;
      this.request = require( 'request' ).defaults({
	baseUrl: this.options.endpoint,
      });
      // The default session in IVCS expires in 4 hours of idle time
      // So the caller probably should not sepecify "expires_in" and let
      // it default.
      this.options.expires_in = this.options.expires_in || (60*60*4);
    }

    grant( key, secret, cb ) {
      let config = {
	endpoint: this.options.endpoint,
	clientId: this.options.clientId,
	clientName: this.options.clientName,
	auth: {
	  partnerId: key,
	  apiKey: secret
	}
      };
      let auth = new app.ivcs.Auth( config );
      auth.startSession( (err, result) => {
	if ( err ) return cb( err );
	let session = result.session;
	
	let accessToken = Tokens.create({
	  sessionSecret: session.sessionSecret,
	  sessionKey: session.sessionKey,
	  partnerId: key,
	  localId: auth.localId,
	}, this.options.expires_in, this.options.signingKey );
	
	let refreshToken = Tokens.create({
	  partnerId: key,
	  localId: auth.localId,
	  sessionKey: session.sessionKey,
	  apiKey: secret,
	  refreshToken: session.refreshToken,
	}, 0, this.options.signingKey );
	
	return cb( null, {
	  access_token: accessToken,
	  refresh_token: refreshToken,
	  token_type: 'Bearer',
	  expires_in: this.options.expires_in,
	});
      });
    }

    verify( token, cb ) {
      let values = Tokens.verify( token, this.options.signingKey );
      if ( ! values ) return cb( new Error( 'Invalid Token' ) );
      let config = {
	endpoint: this.options.endpoint,
	clientId: this.options.clientId,
	clientName: this.options.clientName,
	auth: {
	  partnerId: values.partnerId,
	}
      };
      let auth = new app.ivcs.Auth( config );
      auth.sessionKey = values.sessionKey;
      auth.sessionSecret = values.sessionSecret;
      auth.localId = values.localId;
      auth.verifySession( (err) => {
	cb( err );
      });
    }

    refresh( token, cb ) {
      let values = Tokens.verify( token, this.options.signingKey );
      if ( ! values ) return cb( new Error( 'Invalid Token' ) );
      let config = {
	endpoint: this.options.endpoint,
	clientId: this.options.clientId,
	clientName: this.options.clientName,
	auth: {
	  partnerId: values.partnerId,
	  apiKey: values.apiKey,
	}
      };
      let auth = new app.ivcs.Auth( config );
      auth.refreshToken = values.refreshToken;
      auth.localId = values.localId;
      auth.sessionKey = values.sessionKey;

      auth.reloadSession( (err, result) => {
	if ( err ) return cb( err );
	let session = result.session;
	let accessToken = Tokens.create({
	  sessionSecret: session.sessionSecret,
	  sessionKey: session.sessionKey,
	  partnerId: values.partnerId,
	  localId: auth.localId,
	}, this.options.expires_in, this.options.signingKey );
	
	let refreshToken = Tokens.create({
	  partnerId: values.partnerId,
	  localId: auth.localId,
	  sessionKey: session.sessionKey,
	  apiKey: values.apiKey,
	  refreshToken: session.refreshToken,
	}, 0, this.options.signingKey );
	
	return cb( null, {
	  access_token: accessToken,
	  refresh_token: refreshToken,
	  token_type: 'Bearer',
	  expires_in: this.options.expires_in,
	});
      });
    }

  }

  return OAuth;
}

