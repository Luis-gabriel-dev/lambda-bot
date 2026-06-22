import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { getUserGuilds, isGuildAdmin, type AdminGuild } from "./discord";

// Auth.js v5. Lê AUTH_SECRET, AUTH_DISCORD_ID e AUTH_DISCORD_SECRET do ambiente.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      // Precisamos da lista de servidores do usuário pra checar admin.
      authorization: { params: { scope: "identify guilds" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // No login: guarda o id, o token de acesso e a lista de servidores que o usuário
      // administra (buscada UMA vez aqui, pra não bater na API do Discord a cada request).
      if (account?.access_token) {
        token.accessToken = account.access_token;
        const guilds = await getUserGuilds(account.access_token);
        token.adminGuilds = guilds.filter(isGuildAdmin).map((g) => ({ id: g.id, name: g.name, icon: g.icon }));
      }
      if (profile?.id) token.discordId = String(profile.id);
      return token;
    },
    async session({ session, token }) {
      if (typeof token.discordId === "string") session.user.id = token.discordId;
      if (typeof token.accessToken === "string") session.accessToken = token.accessToken;
      session.adminGuilds = (token.adminGuilds ?? []) as AdminGuild[];
      return session;
    },
  },
});
