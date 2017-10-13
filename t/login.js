"use strict";

let app = require( '../lib/app' );
let ivcs = require( '../index' );

let session;
app.config.ivcs.sessionRefreshed = function( s ) {
  session = s;
};

let auth = new ivcs.Auth( app.config.ivcs );
let args = app.parseargs( process.argv );

auth.login( session, {
  email: args.email,
  password: args.password,
}, function( err, result ) {
  if ( err ) app.exit( err );
  app.log.info( result );
  auth.logout( session, result, function( err ) {
    if ( err ) app.exit( err );
    app.exit();
  });
});
