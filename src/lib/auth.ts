import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { isAllowedGoogleEmail, isGoogleAuthConfigured } from "./google-auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(isGoogleAuthConfigured
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          // Staff and students who already registered with a password use the
          // same school address; linking is safe because Google proves the
          // address and the domain allow-list is enforced in `signIn` below.
          allowDangerousEmailAccountLinking: true,
        })]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) return null;
        if (user.isBanned || user.isDeleted) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
        };
      },
    }),
  ],
  events: {
    // Google already proves the address, so those accounts skip our own
    // verification email.
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        await prisma.user.updateMany({
          where: { email: user.email, emailVerified: null },
          data: { emailVerified: new Date(), isVerified: true },
        });
      }
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        if (!isAllowedGoogleEmail(user.email)) return false;
        if (profile?.email_verified === false) return false;
      }
      // Block banned or soft-deleted users from signing in
      if (user.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { isBanned: true, isDeleted: true },
        });
        if (dbUser?.isBanned || dbUser?.isDeleted) {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // Credentials provider doesn't go through the adapter, so skip DB lookup for it
      if (account?.provider === "credentials") {
        token.id = user.id;
        token.role = user.role;
        return token;
      }
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});
