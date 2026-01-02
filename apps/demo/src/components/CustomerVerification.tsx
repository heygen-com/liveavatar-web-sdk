"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import { Separator } from "./ui/separator";
import type { VerifyCustomerResponse } from "@/src/shopify";
import type { CustomerData } from "@/src/liveavatar/types";
import Image from "next/image";

interface CustomerVerificationProps {
  onVerified: (customerData: CustomerData) => void;
  onError?: (error: string) => void;
}

type VerificationState = "idle" | "loading" | "not_found" | "no_orders";

export default function CustomerVerification({
  onVerified,
  onError,
}: CustomerVerificationProps) {
  const [email, setEmail] = useState("");
  const [verificationState, setVerificationState] =
    useState<VerificationState>("idle");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationState("loading");
    setError(null);

    try {
      const response = await fetch("/api/verify-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data: VerifyCustomerResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error verifying customer");
      }

      if (!data.exists) {
        setVerificationState("not_found");
        return;
      }

      if (!data.hasOrders) {
        setVerificationState("no_orders");
        return;
      }

      // Customer verified with orders - proceed
      if (data.customer) {
        onVerified({
          firstName: data.customer.firstName || undefined,
          lastName: data.customer.lastName || undefined,
          email: data.customer.email || undefined,
          ordersCount: data.customer.ordersCount,
          skinType: data.customer.skinType as CustomerData["skinType"],
          skinConcerns: data.customer.skinConcerns,
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error verifying email";
      setError(errorMessage);
      onError?.(errorMessage);
      setVerificationState("idle");
    }
  };

  const handleGoogleSignIn = () => {
    setIsGoogleLoading(true);
    // After Google Sign In, the callback will redirect to home
    // The page will then verify the email from the session
    signIn("google", { callbackUrl: "/" });
  };

  const renderContent = () => {
    if (verificationState === "not_found") {
      return (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">
            No encontramos tu cuenta
          </h3>
          <p className="text-gray-600 text-sm">
            No hay una cuenta registrada con el email <strong>{email}</strong>.
          </p>
          <p className="text-gray-500 text-xs">
            Si ya has comprado en Beta Skin Tech, asegurate de usar el mismo
            email con el que realizaste tu compra.
          </p>
          <Button
            variant="outline"
            onClick={() => setVerificationState("idle")}
            className="mt-4"
          >
            Intentar con otro email
          </Button>
        </div>
      );
    }

    if (verificationState === "no_orders") {
      return (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-orange-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">
            Debes realizar una compra primero
          </h3>
          <p className="text-gray-600 text-sm">
            Clara es exclusiva para clientes de Beta Skin Tech.
          </p>
          <p className="text-gray-500 text-xs">
            Visita nuestra tienda y realiza tu primera compra para acceder a tu
            asistente personal de skincare.
          </p>
          <div className="flex flex-col gap-2 mt-4">
            <Button
              onClick={() => window.open("https://betaskintech.cl", "_blank")}
              className="bg-gradient-to-br from-neutral-600 via-neutral-700 to-neutral-800 hover:from-neutral-700 hover:to-neutral-900"
            >
              Ir a la tienda
            </Button>
            <Button
              variant="ghost"
              onClick={() => setVerificationState("idle")}
              className="text-gray-500"
            >
              Intentar con otro email
            </Button>
          </div>
        </div>
      );
    }

    // Default: verification form
    return (
      <>
        {error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verify-email" className="text-gray-700">
              Email de compra
            </Label>
            <Input
              id="verify-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="h-11 border-gray-200 focus:border-neutral-500 focus:ring-neutral-500"
              required
              disabled={verificationState === "loading"}
            />
            <p className="text-xs text-gray-500">
              Ingresa el email con el que compraste en Beta Skin Tech
            </p>
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-br from-neutral-600 via-neutral-700 to-neutral-800 hover:from-neutral-700 hover:to-neutral-900 text-white font-medium shadow-md transition-all duration-200"
            disabled={verificationState === "loading"}
          >
            {verificationState === "loading" ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Verificando...
              </span>
            ) : (
              "Verificar"
            )}
          </Button>
        </form>

        <div className="relative">
          <Separator className="my-4" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-sm text-gray-400">
            o
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full h-11 border-gray-200 hover:bg-gray-50 font-medium transition-all duration-200"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Conectando...
            </span>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuar con Google
            </>
          )}
        </Button>
      </>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="bg-blur-circle-1 -top-40 -right-40" />
        <div className="bg-blur-circle-2 -bottom-40 -left-40" />
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-xl border-0 card-ios">
        <CardHeader className="text-center pb-2">
          {/* Clara Logo/Branding */}
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center shadow-lg border border-white/50 overflow-hidden p-2">
            <Image
              src="/images/clara-logo.png"
              alt="Clara"
              width={64}
              height={64}
              className="w-full h-full object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-neutral-900">
            Bienvenida a Clara
          </CardTitle>
          <CardDescription className="text-gray-500">
            Tu asistente personal de skincare
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">{renderContent()}</CardContent>
      </Card>
    </div>
  );
}
