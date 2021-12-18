import moduleAlias = require( 'module-alias' );
import path = require( 'path' );
moduleAlias.addAliases( {
	src: __dirname,
	config: path.join( __dirname, '../config' )
} );

import fs = require( 'fs' );
import winston = require( 'winston' );
import jQueryFactory = require( 'jquery' );
import Util from 'util';

import { JSDOM } from 'jsdom';
import { Telegraf, Context } from 'telegraf';
import { InlineQueryResult, InputMessageContent } from 'typegram/inline';
import * as TT from 'typegram';

import { config } from 'config/config';
import { LogToChannel } from 'src/logToChannel';
import { processTextFile } from 'src/processTextFile';

const QUERY_RESPONSE_TIMEOUT = 'query is too old and response timeout expired or query ID is invalid';
const CANNOT_PARSE_ENTITIES = 'Can\'t parse entities';

// 日志初始化
const logFormat: winston.Logform.FormatWrap = winston.format( function ( info: winston.Logform.TransformableInfo ) {
	info.level = info.level.toUpperCase();
	if ( info.stack ) {
		info.message = `${ info.message }\n${ info.stack }`;
	}
	return info;
} );

winston.add( new winston.transports.Console( {
	format: winston.format.combine(
		logFormat(),
		winston.format.colorize(),
		winston.format.timestamp( {
			format: 'YYYY-MM-DD HH:mm:ss'
		} ),
		winston.format.printf( ( info ) => `${ info.timestamp } [${ info.level }] ${ info.message }` )
	)
} ) );

process.on( 'unhandledRejection', function ( _reason, promise ) {
	promise.catch( function ( e ) {
		winston.error( 'Unhandled Rejection: ', e );
	} );
} );

process.on( 'uncaughtException', function ( err ) {
	winston.error( 'Uncaught exception:', err );
} );

process.on( 'rejectionHandled', function () {
	// 忽略
} );

process.on( 'warning', ( warning ) => {
	winston.warn( warning );
} );

// 日志等级、文件设置
if ( config.logging && config.logging.level ) {
	winston.level = config.logging.level;
} else {
	winston.level = 'info';
}

if ( config.logging && config.logging.logfile ) {
	const files: winston.transports.FileTransportInstance = new winston.transports.File( {
		filename: config.logging.logfile,
		format: winston.format.combine(
			logFormat(),
			winston.format.timestamp( {
				format: 'YYYY-MM-DD HH:mm:ss'
			} ),
			winston.format.printf( function ( info ) {
				return `${ info.timestamp } [${ info.level }] ${ info.message }`;
			} )
		)
	} );
	winston.add( files );
}

const jQuery = jQueryFactory( Object.assign( new JSDOM( '', {
	url: 'https://api.telegram.org/'
} ).window ), true );

const titles = processTextFile( config.msgs.title );
const thumbUrls = processTextFile( config.msgs.thumb_url );
const contents = processTextFile( config.msgs.content );
const wraps = processTextFile( config.msgs.wrap );
const errors = processTextFile( config.msgs.error );

winston.info( 'EricDress v1.0.0' );
winston.info( '' );
winston.info( 'Starting Telegram bot...' );

const bot = new Telegraf( config.token );

if ( config.logging.logToChannel ) {
	winston.add( new LogToChannel( {
		telegraf: bot,
		logChannel: config.logging.logToChannel
	} ) );
}

function random<T>( arr: T[] ): T {
	return arr.length > 1 ? arr[ Math.floor( Math.random() * arr.length ) ] : arr[ 0 ];
}

function htmlEscape( str: string ): string {
	return jQuery( '<div>' ).text( str ).html().trim();
}

function getFormatText( text: string, ctx: Context, isSpecial?: boolean ): string {
	const needwrap = Math.random() % 5 < 0.03 && !isSpecial;
	const wrap = needwrap ? random( wraps ) : '{TEXT}';
	return wrap
		.replace(
			/{TEXT}/g,
			text
		)
		.replace(
			/{NAME}/g,
			'<a href="tg://user?id=' + ctx.from.id + '">' +
			htmlEscape( ctx.from.first_name + ' ' + ( ctx.from.last_name || '' ) ) +
			'</a>'
		);
}

function getRandomID(): string {
	return Math.floor( +new Date() + Math.random() * 10000 ).toString( 16 );
}

function buildInlineQuery( text: string, ctx: Context ): InlineQueryResult[] {
	const result: {
		id: string;
		title: string;
		thumb_url: string;
		parse_mode: 'HTML';
	} = {
		id: getRandomID(),
		title: random( titles ),
		thumb_url: random( thumbUrls ),
		parse_mode: 'HTML'
	};
	if ( /^<img.*>$/.exec( text ) ) {
		try {
			const $img: JQuery<HTMLImageElement> = jQuery( jQuery.parseHTML( '<div>' + text + '</div>' ) ).find( 'img' );
			return [ Object.assign<typeof result, {
				type: 'photo';
				photo_url: string;
				caption: string;
			}>( result, {
				type: 'photo',
				photo_url: $img.attr( 'src' ),
				caption: getFormatText( $img.attr( 'alt' ), ctx, true )
			} ) ];
		} catch ( e ) {
			winston.error( Util.format( 'Failture: fail to parse img html "%s": %s', text, e ) );
		}
	}
	return [ Object.assign<typeof result, {
		type: 'article';
		input_message_content: InputMessageContent;
	}>( result, {
		type: 'article',
		input_message_content: {
			message_text: getFormatText( text, ctx ),
			parse_mode: 'HTML'
		}
	} ) ];
}

function buildCommandReply( ctx: Context ): Promise<TT.Message> {
	const text = random( contents );
	if ( /^<img.*>$/.exec( text ) ) {
		try {
			const $img: JQuery<HTMLImageElement> = jQuery( jQuery.parseHTML( '<div>' + text + '</div>' ) ).find( 'img' );
			return ctx.replyWithPhoto( $img.attr( 'src' ), {
				caption: getFormatText( $img.attr( 'alt' ), ctx, true ),
				parse_mode: 'HTML'
			} );
		} catch ( e ) {
			winston.error( Util.format( 'Failture: fail to parse img html "%s": %s', text, e ) );
		}
	}
	return ctx.reply( text, {
		parse_mode: 'HTML'
	} );
}

bot.on( 'inline_query', function ( ctx ) {
	winston.debug( Util.format( '[inline] from: %d, query: %s', ctx.inlineQuery.from.id, ctx.inlineQuery.query ) );
	const query = random( contents );

	return ctx.answerInlineQuery( [
		...buildInlineQuery( query, ctx )
	], {
		cache_time: 0
	} ).catch( function ( ex ) {
		if ( String( ex ).match( QUERY_RESPONSE_TIMEOUT ) ) {
			winston.warn( Util.format( 'response timeout expired, check your server config' ) );
			return;
		} else if ( String( ex ).match( CANNOT_PARSE_ENTITIES ) ) {
			winston.warn( Util.format( 'string "%s" can\'t parse as html.', query ) );
		} else {
			winston.error( ex );
		}

		ctx.answerInlineQuery( [
			{
				type: 'article',
				id: getRandomID(),
				title: '錯誤',
				description: '錯誤',
				input_message_content: {
					message_text: random( errors )
				}
			}
		], {
			cache_time: 0
		} );
	} );
} );

bot.command( 'ericadress', async function ( ctx ) {
	winston.debug( Util.format(
		'[cmd] chat: %d, from: %d, text: %s',
		ctx.chat.id,
		ctx.message.sender_chat?.id || ctx.from.id,
		ctx.message.text
	) );
	return buildCommandReply( ctx );
} );

bot.catch( function ( err ) {
	winston.error( 'TelegramBot error:', err );
} );

if ( config.launchType === 'webhook' ) {
	try {
		config.webhook.url = new URL( config.webhook.url ).href;
	} catch ( e ) {
		winston.error( `Can't parse webhook url: ${ e }` );
		// eslint-disable-next-line no-process-exit
		process.exit( 1 );
	}

	// 自动设置Webhook网址
	if ( config.webhook.url ) {
		if ( config.webhook.ssl?.certPath ) {
			bot.telegram.setWebhook( config.webhook.url, {
				certificate: {
					source: config.webhook.ssl.certPath
				}
			} );
		} else {
			bot.telegram.setWebhook( config.webhook.url );
		}
	}

	// 启动Webhook服务器
	if ( !config.webhook.tlsOptions && config.webhook.ssl && config.webhook.ssl.certPath ) {
		config.webhook.tlsOptions = {
			key: fs.readFileSync( config.webhook.ssl.keyPath ),
			cert: fs.readFileSync( config.webhook.ssl.certPath )
		};
		if ( config.webhook.ssl.caPath ) {
			config.webhook.tlsOptions.ca = [
				fs.readFileSync( config.webhook.ssl.caPath )
			];
		}
	}

	bot.launch( {
		webhook: config.webhook
	} ).then( function () {
		winston.info( `Telegram bot has started at ${ config.webhook.url }.` );
	} );
} else {
	bot.launch().then( function () {
		winston.info( 'Telegram bot has started.' );
	} );
}
