const util = require( 'util' );
const { fork } = require( 'child_process' );
const path = require( 'path' );
const fs = require( 'fs' );

const log = {
	write( format, ...params ) {
		return process.stdout.write( util.format( format, ...params ) );
	},
	writeln( format, ...params ) {
		return log.write( format, ...params, '\n' );
	},
	error( format, ...params ) {
		return process.stderr.write( util.format( format, ...params ) );
	},
	errorln( format, ...params ) {
		return log.error( format, ...params, '\n' );
	}
};

function runCompilation() {
	return new Promise( function ( resolve, reject ) {
		let starttime = Date.now();
		let endtime;

		let tsc;
		try {
			tsc = require.resolve( 'typescript/bin/tsc' );
		} catch {
			log.errorln( 'Error: Fail to found tsc script, did you want to run "npm install" first?' );
			reject( false );
		}

		let child = fork( tsc );
		let bfout = Buffer.from( '' );
		let bferr = Buffer.from( '' );
		if ( child.stdout ) {
			child.stdout.on( 'data', function ( buf ) {
				bfout = Buffer.concat( [ bfout, Buffer.from( buf ) ] );
			} );
		}
		if ( child.stderr ) {
			child.stderr.on( 'data', function ( buf ) {
				bferr = Buffer.concat( [ bferr, Buffer.from( buf ) ] );
			} );
		}
		child.on( 'close', function ( code ) {
			clearTimeout( timeout );
			// Remove trailing whitespace (newline)
			const output = bfout.toString().trim() || bferr.toString().trim();
			log.writeln( '' );

			endtime = Date.now();
			if ( code === 8 ) {
				log.errorln( 'Error: Node was unable to run tsc.  Possibly it could not be found?' );
				return resolve( false );
			}
			let isError = ( code !== 0 );
			let level1ErrorCount = 0, level5ErrorCount = 0, nonEmitPreventingWarningCount = 0;
			let hasTS7017Error = false;
			let hasPreventEmitErrors = output.split( '\n' ).reduce( function ( memo, errorMsg ) {
				let isPreventEmitError = false;
				if ( errorMsg.search( /error TS7017:/g ) >= 0 ) {
					hasTS7017Error = true;
				}
				if ( errorMsg.search( /error TS1\d+:/g ) >= 0 ) {
					level1ErrorCount += 1;
					isPreventEmitError = true;
				} else if ( errorMsg.search( /error TS5\d+:/ ) >= 0 ) {
					level5ErrorCount += 1;
					isPreventEmitError = true;
				} else if ( errorMsg.search( /error TS\d+:/ ) >= 0 ) {
					nonEmitPreventingWarningCount += 1;
				}
				return memo || isPreventEmitError;
			}, false ) || false;
			let isOnlyTypeErrors = !hasPreventEmitErrors;
			if ( hasTS7017Error ) {
				log.writeln( ( 'Note: You may wish to enable the suppressImplicitAnyIndexErrors' +
				' grunt-ts option to allow dynamic property access by index.  This will' +
				' suppress TypeScript error TS7017.' ).magenta );
			}
			if ( level1ErrorCount + level5ErrorCount + nonEmitPreventingWarningCount > 0 ) {
				if ( level1ErrorCount + level5ErrorCount > 0 ) {
					log.write( ( '>> ' ).red );
				} else {
					log.write( ( '>> ' ).green );
				}
				if ( level5ErrorCount > 0 ) {
					log.write( level5ErrorCount.toString() + ' compiler flag error' +
					( level5ErrorCount === 1 ? '' : 's' ) + '  ' );
				}
				if ( level1ErrorCount > 0 ) {
					log.write( level1ErrorCount.toString() + ' syntax error' +
					( level1ErrorCount === 1 ? '' : 's' ) + '  ' );
				}
				if ( nonEmitPreventingWarningCount > 0 ) {
					log.write( nonEmitPreventingWarningCount.toString() +
					' non-emit-preventing type warning' +
					( nonEmitPreventingWarningCount === 1 ? '' : 's' ) + '  ' );
				}
				log.writeln( '' );
				if ( isOnlyTypeErrors ) {
					log.write( ( '>> ' ).green );
					log.writeln( 'Type errors only.' );
				}
			}
			let isSuccessfulBuild = ( !isError || ( isError && isOnlyTypeErrors ) );
			if ( isSuccessfulBuild ) {
				let time = ( endtime - starttime ) / 1000;
				log.writeln( 'TypeScript compilation complete: ' + time.toFixed( 2 ) + 's.' );
			} else {
				log.errorln( 'Error: tsc return code: ' + code );
			}
			return resolve( isSuccessfulBuild );
		} );

		const timeout = setTimeout( function () {
			log.errorln( 'Error: tsc run timeout.' );
			child.kill( 'SIGKILL' );
			reject( new Error( 'Time out (180s).' ) );
		}, 180000 );
	} );
}

log.writeln( 'try to compilate typescript...' );
runCompilation()
	.then( function ( isSuccessfulBuild ) {
		if ( !isSuccessfulBuild ) {
			// eslint-disable-next-line no-process-exit
			process.exit( 1 );
		}

		log.writeln( '' );

		/**
		 * @type {import("../config/config.type").ConfigTS}
		 */
		let cnf;
		log.write( 'try to load project config... ' );
		try {
			cnf = require( __dirname + '/../build/config/config.js' ).config;
			log.writeln( 'success.' );
		} catch ( e ) {
			if ( e instanceof Error && e.code ) {
				log.error( 'fail, code: %s.', e.code );
				// eslint-disable-next-line no-process-exit
				process.exit( 1 );
			} else {
				log.error( 'fail, reason:', e );
			}
		}
		for ( const key in cnf.msgs ) {
			/**
			 * @type {import("../config/config.type").TextOrFile}
			 */
			const msg = cnf.msgs[ key ];
			if ( typeof msg === 'object' && !Array.isArray( msg ) ) {
				const file = msg.path;
				if ( !path.isAbsolute( file ) ) {
					const oldFile = path.join( __dirname, '../config', file );
					const newFile = path.join( __dirname, '../build/config', file );
					log.write( 'copy "%s" to "%s" (register by key "%s")... ', oldFile, newFile, key );
					try {
						fs.copyFileSync( oldFile, newFile );
						log.writeln( 'success.' );
					} catch ( error ) {
						log.errorln( 'fail, reason:', error );
					}
				}
			}
		}
		if ( cnf.reloadFile ) {
			const reloadFile = path.isAbsolute( cnf.reloadFile ) ? path.normalize( cnf.reloadFile ) : path.join( __dirname, '../config', cnf.reloadFile );
			log.write( 'found reloadFile "%s", try to reload it... ', reloadFile );
			try {
				fs.writeFileSync( reloadFile, new Date().toISOString() );
				log.writeln( 'success.' );
			} catch ( error ) {
				log.errorln( 'fail, reason:', error );
			}
		}
	} )
	.catch( function () {
		// eslint-disable-next-line no-process-exit
		process.exit( 1 );
	} );
