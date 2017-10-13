"use strict";

let app = require( '../lib/app' );
let ivcs = require( '../index' );

let session;
app.config.ivcs.sessionRefreshed = function( s ) {
  session = s;
};

let auth = new ivcs.Auth( app.config.ivcs );
let args = app.parseargs( process.argv );

auth.authenticatedRequest( session, {
  uri: '/customer/forgotPassword/' + encodeURIComponent( args.email ),
  method: 'GET',
}, function( err, result ) {
  if ( err ) app.exit( err );
  app.log.info( result );
  app.exit();
});
