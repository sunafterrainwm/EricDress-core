import { LaunchPollingOptions, LaunchWebhookOptions } from 'telegraf/typings/telegraf';

export type TextFile = string | string[] | {
	path: string;

	parsemode?: 'txt' | 'json';
}

export interface ConfigTS {
	/**
	 * Telegram token
	 */
	token: string;

	/**
	 * 使用 polling 還是 webhook
	 */
	launchType?: 'polling' | 'webhook';

	polling?: LaunchPollingOptions;

	webhook?: LaunchWebhookOptions & {
		/**
		 * Webhook 最終的完整 URL，可被外部存取，用於呼叫 Telegram 介面自動設定網址
		 */
		url?: string;

		ssl?: {
			certPath: string;
			keyPath: string;
			caPath: string;
		}
	};

	/**
	 * 系統紀錄檔
	 */
	logging: {
		/**
		 * 紀錄檔等級：從詳細到簡單分別是 debug、info、warning、error，推薦用 info
		 */
		level: 'debug' | 'info' | 'warning' | 'error';

		/**
		 * 紀錄檔檔名，如留空則只向螢幕輸出
		 */
		logfile: string;
	};

	msgs: Record<'title' | 'thumb_url' | 'content' | 'wrap' | 'error', TextFile>
}
