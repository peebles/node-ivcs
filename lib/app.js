"use strict";
//
// Simple library to create an app structure with
// log, config, exit and parseargs
//
let winston = require( 'winston' );

let app = {};
app.config = require( '../config.json' );
app.log = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      level: 'debug',
      handleExceptions: true,
      humanReadableUnhandledException: true,
      prettyPrint: true,
      timestamp: true,
      colorize: true,
    })
  ]
});

app.exit = function( err ) {
  if ( err ) app.log.error( err );
  process.exit( err ? 1 : 0 );
}

app.parseargs = function( argv ) {
  let bag = {};
  let arg;
  while( arg = argv.shift() ) {
    let i = arg.match( /^--(.+)/ );
    if ( i && i.length == 2 ) {
      if ( argv[0] && argv[0].match( /^--(.+)/ ) )
        bag[ i[1] ] = true;
      else if ( ! argv[0] )
        bag[ i[1] ] = true;
      else {
        let v = argv.shift();
        if ( v.match( /^\d+$/ ) )
          v = Number( v );
        bag[ i[1] ] = v;
      }
    }
  }
  return bag;
}
  
module.exports = app;
