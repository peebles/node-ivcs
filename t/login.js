"use strict";

let app = require( '../lib/app' );
let ivcs = require( '../index' );

let auth = new ivcs.Auth( app.config.ivcs );
let args = app.parseargs( process.argv );

auth.login({
  email: args.email,
  password: args.password,
}, function( err, result ) {
  if ( err ) app.exit( err );
  app.log.info( result );
  auth.logout( result, function( err, result ) {
    app.log.info( result );
    app.exit();
  });
});
