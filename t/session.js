"use strict";

let app = require( '../lib/app' );
let ivcs = require( '../index' );

let session;
app.config.ivcs.sessionRefreshed = function( s ) {
  session = s;
};

let auth = new ivcs.Auth( app.config.ivcs );
app.log.debug( 'start session...' );
auth.startSession( function( err, newsession ) {
  if ( err ) app.exit( err );
  session = newsession;
  app.log.debug( 'session:', session );
  app.log.debug( 'verify session...' );
  auth.verifySession( session, function( err, body, headers ) {
    if ( err ) app.exit( err );
    app.log.debug( 'verified: body:', body, 'headers:', headers );
    app.log.debug( 'reload session...' );
    auth.reloadSession( session, function( err, result ) {
      if ( err ) app.exit( err );
      app.log.debug( 'reloaded:', result );
      auth.verifySession( session, function( err, body, headers ) {
	if ( err ) app.exit( err );
	app.log.debug( 'verified: body:', body, 'headers:', headers );
	app.log.debug( 'end session...' );
	auth.endSession( session, function( err, result ) {
	  if ( err ) app.exit( err );
	  app.log.debug( 'end session:', result );
	  app.exit();
	});
      });
    });
  });
});

