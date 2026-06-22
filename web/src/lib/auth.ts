import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

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
      // No login, guardamos o token de acesso (pra ler os guilds) e o id do Discord.
      if (account?.access_token) token.accessToken = account.access_token;
      if (profile?.id) token.discordId = String(profile.id);
      return token;
    },
    async session({ session, token }) {
      if (typeof token.discordId === "string") session.user.id = token.discordId;
      if (typeof token.accessToken === "string") session.accessToken = token.accessToken;
      return session;
    },
  },
});
