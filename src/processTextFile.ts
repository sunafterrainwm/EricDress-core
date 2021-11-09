/**
 * Warning
 * 如果你無法確定你的更改是否會損壞
 * 請不要任意變更此檔案
 */
import fs from 'fs';
import path from 'path';

import type { TextFile } from 'config/config.type';

function pathReslove( p: string ) {
	try {
		return require.resolve( p );
	} catch {
		return require.resolve( path.join( __dirname, '../config/', p ) );
	}
}

export function processTextFile( conf: TextFile ): string[] {
	if ( typeof conf === 'string' ) {
		return [ conf ];
	} else if ( conf instanceof Array ) {
		return conf;
	} else {
		const file = fs.readFileSync( pathReslove( conf.path ) ).toString( 'utf-8' );

		if ( conf.parsemode === 'json' ) {
			return JSON.parse( file );
		} else {
			return file.split( ',' )
				.map( function ( val: string ): string {
					return val.trim();
				} )
				.filter( function ( val: string ): boolean {
					return !!val;
				} );
		}
	}
}
