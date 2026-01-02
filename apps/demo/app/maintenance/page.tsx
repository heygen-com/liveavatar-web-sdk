import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { AlertTriangle, Clock, Wrench } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          {/* Icon */}
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Wrench className="w-8 h-8 text-white" />
          </div>

          <Badge className="mx-auto mb-3 bg-amber-100 text-amber-800 border-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            En mantenimiento
          </Badge>

          <CardTitle className="text-2xl font-bold text-gray-800">
            Demo en actualización
          </CardTitle>
          <CardDescription className="text-gray-600 mt-2">
            Estamos mejorando la experiencia de Clara para ti
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center space-y-4 pt-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 text-left">
              La demo está temporalmente fuera de servicio mientras implementamos mejoras.
              Por favor, vuelve a intentarlo en unos minutos.
            </p>
          </div>

          <p className="text-xs text-gray-400">
            Si necesitas asistencia urgente, contacta a soporte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
