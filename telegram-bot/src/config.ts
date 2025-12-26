import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
    telegram: {
          token: process.env.TELEGRAM_BOT_TOKEN!,
          mode: process.env.BOT_MODE || 'polling',
          domain: process.env.BOT_DOMAIN,
          port: parseInt(process.env.BOT_PORT || '3000', 10),
    },
    claude: {
          apiKey: process.env.CLAUDE_API_KEY!,
          model: 'claude-3-5-haiku-20241022',
    },
    supabase: {
          url: process.env.SUPABASE_URL!,
          anonKey: process.env.SUPABASE_ANON_KEY!,
          serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    redis: {
          url: process.env.REDIS_URL,
    },
};

// Validate required env vars
const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
    'CLAUDE_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

for (const variable of requiredVars) {
    if (!process.env[variable]) {
          throw new Error(`Missing environment variable: ${variable}`);
    }
}
