"use strict";

let app = require( '../lib/app' );
let ivcs = require( '../index' );

let auth = new ivcs.Auth( app.config.ivcs );
let args = app.parseargs( process.argv );

auth.authenticatedRequest({
  uri: '/customer/',
  method: 'POST',
  json: {
    customer: {
      email: args.email,
      password: args.password,
      name: args.givenName,
      lastName: args.surname,
      userType: 'OWNER',
    }
  }
}, function( err, result ) {
  if ( err ) app.exit( err );
  app.log.info( result );
  app.exit();
});
