"use strict";

let app = require( '../lib/app' );
let ivcs = require( '../index' );

app.config.ivcs.expires_in = 3600;
app.config.ivcs.signingKey = '123456789012345678901234567890'; // NOT A GREAT KEY!!

let key    = app.config.ivcs.auth.partnerId;
let secret = app.config.ivcs.auth.apiKey;

delete app.config.ivcs.auth;

let oauth = new ivcs.OAuth( app.config.ivcs );

app.log.debug( 'grant' );
oauth.grant( key, secret, function( err, session ) {
  if ( err ) app.exit( err );
  app.log.debug( 'session:', session );
  app.log.debug( 'verify session' );
  oauth.verify( session.access_token, function( err ) {
    if ( err ) app.exit( err );
    app.log.debug( 'reload session' );
    oauth.refresh( session.refresh_token, function( err, result ) {
      if ( err ) app.exit( err );
      app.log.debug( 'reloaded session:', result );
      app.exit();
    });
  });
});

