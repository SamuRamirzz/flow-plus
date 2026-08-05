import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Habilita <ViewTransition> de React + integración de Next con la
    // View Transitions API nativa del navegador — necesario para la
    // transición Agenda ⇄ IA (Sprint 4): sin esto <ViewTransition> no
    // anima nada durante la navegación entre rutas.
    viewTransition: true,
  },
};

export default nextConfig;
