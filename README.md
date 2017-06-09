# Intelli-vision Video Cloud Services Client Library

## Usage

```bash
npm install node-ivcs
```

```javascript
"use strict";

let ivcs = require( 'node-ivcs' );

let auth = new ivcs.Auth( config );

// Login and logout
//
auth.login({ email: "joe.shmoo@gmail.com", password: "secret" }, function( err, user ) {
  if ( err ) process.exit( err );
  console.log( JSON.stringify( user, null, 2 ) );
  auth.logout( user, function( err ) {
    if ( err ) process.exit( err );
    console.log( 'Bye!' );
    process.exut(0);
  });
});

// Forgot password
//
auth.authenticatedRequest({
  uri: '/customer/forgotPassword/' + encodeURIComponent( args.email ),
  method: 'GET',
}, function( err, result ) {
  if ( err ) app.exit( err );
  app.log.info( result );
  app.exit();
});

// Resend verification email
//
auth.authenticatedRequest({
  uri: '/customer/resendemail',
  method: 'GET',
  qs: { emailId: args.email }
}, function( err, result ) {
  if ( err ) app.exit( err );
  app.log.info( result );
  app.exit();
});

// Add a new user account
//
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

```

## Configuration

The `ivcs.Auth()` constructor requires the following config structure:

```javascript
{
  "endpoint": "https://IVCS-ENDPOINT",
  "clientId": "SOME-RANDOM-ID",
  "clientName": "SOME_RANDOM_NAME",
  "auth": {
    "partnerId": "YOUR-PARTNER-ID",
    "apiKey": "YOUR-API-KEY"
  }
}
```

## OAuth2 

There are methods you can use to implement an OAuth2 handshake using IVCS credentials.

```javascript
let ivcs = require( 'node-ivcs' );
let oauth = new ivcs.OAuth({
  endpoint: "https://ivcs-endpoint",
  clientId: "some-random-string",
  clientName: "arbitrary-name-of-this-client",
  expires_in: 3600,
  signingKey: "verylongrandomstring"
});

// User will make a POST to say /oauth/grant, passing "key" equal to their assigned `partnerId` and
// "secret" set to their assigned `apiKey`.  Then you can call:
oauth.grant( key, secret, function( err, result ) {
  // The result will look like:
  // { "access_token": ACCESS-TOKEN,
  //   "refresh_token": REFRESH_TOKEN,
  //   "token_type": "Bearer",
  //   "expires_in": 3600
  // }
  // This gets passed back to the client
});

// The client will then make requests that include the header:
//   Authorization: Bearer ACCESS-TOKEN
// Call this to verify the ACCESS-TOKEN
oauth.verify( token, function( err ) {
  // if err == null, its ok, else its not
});

// The client can refresh a token.  They will do a POST to something like /oauth/refresh with "refresh_token" set to
// the refresh token returned in a grant.  Then you can call
oauth.refresh( token, function( err, result ) {
  // The result will look like:
  // { "access_token": ACCESS-TOKEN,
  //   "refresh_token": REFRESH_TOKEN,
  //   "token_type": "Bearer",
  //   "expires_in": 3600
  // }
  // This gets passed back to the client
});

```
