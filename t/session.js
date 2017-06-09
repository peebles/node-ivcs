"use strict";

let app = require( '../lib/app' );
let ivcs = require( '../index' );

let auth = new ivcs.Auth( app.config.ivcs );
app.log.debug( 'start session' );
auth.startSession( function( err, session ) {
  if ( err ) app.exit( err );
  app.log.debug( 'session:', session );
  app.log.debug( 'reload session' );
  auth.reloadSession( function( err, result ) {
    if ( err ) app.exit( err );
    app.log.debug( 'reloaded:', result );
    app.log.debug( 'end session' );
    auth.endSession( function( err, result ) {
      if ( err ) app.exit( err );
      app.log.debug( 'end session:', result );
      app.exit();
    });
  });
});

