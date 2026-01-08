"use client";

import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  AlertCircle,
  ShoppingBag,
  Loader2,
  XCircle,
  Wrench,
} from "lucide-react";

export type PageState =
  | "loading"
  | "verified"
  | "no_orders"
  | "invalid_token"
  | "error"
  | "maintenance";

interface CustomerData {
  firstName?: string;
  email?: string;
  ordersCount?: number;
  lastOrderDate?: string;
}

interface ShopifyVerificationStatesProps {
  state: PageState;
  customerData?: CustomerData;
  onRetry?: () => void;
}

export function ShopifyVerificationStates({
  state,
  customerData,
  onRetry,
}: ShopifyVerificationStatesProps) {
  // Don't render anything for verified state (Clara will show)
  if (state === "verified") {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-blue-50">
      <Card className="max-w-md w-full p-8 shadow-xl">
        {state === "loading" && (
          <div className="text-center">
            <Loader2 className="w-16 h-16 mx-auto mb-6 text-purple-600 animate-spin" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Verificando tu cuenta...
            </h2>
            <p className="text-gray-600">
              Estamos confirmando tu información de Beta Skincare
            </p>
          </div>
        )}

        {state === "no_orders" && (
          <div className="text-center">
            <ShoppingBag className="w-16 h-16 mx-auto mb-6 text-amber-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ¡Hola{customerData?.firstName ? ` ${customerData.firstName}` : ""}
              !
            </h2>
            <p className="text-gray-600 mb-6">
              Para acceder a Clara, nuestra asesora virtual de skincare,
              necesitas tener al menos una compra en Beta Skincare.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-800">
                Una vez que realices tu primera compra, podrás chatear con Clara
                para recibir recomendaciones personalizadas sobre tu rutina de
                skincare.
              </p>
            </div>
            <Button
              onClick={() => (window.location.href = "https://betaskintech.cl")}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              Ir a la Tienda
            </Button>
          </div>
        )}

        {state === "invalid_token" && (
          <div className="text-center">
            <XCircle className="w-16 h-16 mx-auto mb-6 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No pudimos verificar tu identidad
            </h2>
            <p className="text-gray-600 mb-6">
              El enlace que usaste puede estar vencido o ser inválido. Por
              favor, intenta acceder nuevamente desde tu cuenta en Beta
              Skincare.
            </p>
            <div className="space-y-3">
              {onRetry && (
                <Button onClick={onRetry} variant="outline" className="w-full">
                  Volver a intentar
                </Button>
              )}
              <Button
                onClick={() =>
                  (window.location.href = "https://betaskintech.cl/account")
                }
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Ir a Mi Cuenta
              </Button>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-6 text-orange-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Error temporal
            </h2>
            <p className="text-gray-600 mb-6">
              Estamos experimentando problemas técnicos. Por favor, intenta
              nuevamente en unos minutos.
            </p>
            {onRetry && (
              <Button
                onClick={onRetry}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Reintentar
              </Button>
            )}
          </div>
        )}

        {state === "maintenance" && (
          <div className="text-center">
            <Wrench className="w-16 h-16 mx-auto mb-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Mantenimiento programado
            </h2>
            <p className="text-gray-600 mb-6">
              Clara está temporalmente en mantenimiento. Volveremos pronto con
              mejoras para ti.
            </p>
            <Button
              onClick={() => (window.location.href = "https://betaskintech.cl")}
              variant="outline"
              className="w-full"
            >
              Volver a la Tienda
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
