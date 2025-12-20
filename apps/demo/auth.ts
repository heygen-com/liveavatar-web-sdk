import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// Demo users for MVP - In production, use a database
const DEMO_USERS = [
  {
    id: "1",
    email: "demo@clara.ai",
    name: "Demo User",
    // Password: demo123
    passwordHash:
      "$2b$10$BqSU623LxazsqzTGTURYAuDLc0pfscpYffKgFCMlKiFIENDsWPeG2",
  },
];

const providers: Provider[] = [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
  }),
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email as string;
      const password = credentials?.password as string;

      if (!email || !password) {
        return null;
      }

      const user = DEMO_USERS.find((u) => u.email === email);

      if (!user) {
        return null;
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
      };
    },
  }),
];

const nextAuth = NextAuth({
  providers,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Add user.id to JWT token during sign-in
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    // Expose user.id to client session
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    // Middleware authorization check
    authorized: async ({ auth }) => {
      return !!auth;
    },
  },
});

// Explicitly type exports to avoid pnpm hoisting issues
export const handlers = nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;
export const auth = nextAuth.auth;
