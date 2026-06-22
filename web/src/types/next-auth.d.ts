import type { DefaultSession } from "next-auth";

interface AdminGuildLite {
  id: string;
  name: string;
  icon: string | null;
}

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    adminGuilds?: AdminGuildLite[];
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    accessToken?: string;
    adminGuilds?: AdminGuildLite[];
  }
}
