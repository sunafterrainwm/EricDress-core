import { ConfigTS } from 'config/config.type';

/**
 * 機器人的設定檔
 */
export const config: ConfigTS = {
	token: '', // BotFather 給你的 Token，類似「123456789:q234fipjfjaewkflASDFASjaslkdf」

	// 使用 polling 還是 webhook
	launchType: 'polling',

	// 使用 Webhook 模式，參見 https://core.telegram.org/bots/webhooks
	webhook: {
		port: 0, // Webhook 埠，為 0 時不啟用 Webhook
		hookPath: '', // Webhook 路徑
		url: '', // Webhook 最終的完整 URL，可被外部存取，用於呼叫 Telegram 介面自動設定網址
		ssl: {
			certPath: '', // SSL 憑證，為空時使用 HTTP 協定
			keyPath: '', // SSL 金鑰
			caPath: '' // 如使用自簽章憑證，CA 憑證路徑
		}
	},

	logging: {
		/**
		 * 紀錄檔等級：從詳細到簡單分別是 debug、info、warning、error，推薦用 info
		 */
		level: 'debug',

		/**
		 * 紀錄檔檔名，如留空則只向螢幕輸出
		 */
		logfile: ''
	},

	// inline bot 的訊息
	//
	// title - ininle query 的訊息
	// thumb_url - 圖片
	// content - 訊息部分，格式請參考[format.md](../format.md)
	// wrap - 隨機將上面的訊息包裝起來，格式請參考[format.md](../format.md)
	// error - 建立 inline query 失敗的回覆訊息
	//
	// 可以使用
	// 1. 字串
	// 2. 陣列
	// 3. 讀取檔案，格式如下
	// {
	//    path: '', // 檔案位置，如果在config目錄底下可以僅填入檔名
	//    parsemode: 'text' // 可填 text （純文字檔，以「,」分隔項目） 或 json （必須要是一個陣列）
	// }
	msgs: {
		title: '標題',

		thumb_url: [
			'https://example.org/thumb_url1.jpg',
			'https://example.org/thumb_url2.jpg'
		],

		content: {
			path: 'content.txt'
		},

		wrap: {
			path: 'wrap.txt'
		},

		error: '初始化失敗。'
	},

	// 硬封鎖用戶
	// 同時會封鎖指令和inline query
	blockFromID: [],

	// 硬封鎖群組
	ignoreChatID: []
};
