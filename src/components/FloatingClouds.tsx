'use client';

import React, { useEffect, useRef } from 'react';

interface FloatingCloudsProps {
  className?: string;
  preset?: 'hero' | 'banner';
  density?: number;
  opacity?: number;
}

interface CloudParticle {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  vx: number;
  vy: number;
  pulsePhase: number;
  pulseSpeed: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle: number;
  colorTone: 'silver' | 'slate' | 'cool';
}

export function FloatingClouds({
  className = '',
  preset = 'hero',
  density = 28,
  opacity = 1,
}: FloatingCloudsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Initialize cloud particles based on preset
    const particles: CloudParticle[] = [];

    const initParticles = (w: number, h: number) => {
      particles.length = 0;

      // Define cluster centers
      const centers = preset === 'hero'
        ? [
            { cx: w * 0.72, cy: h * 0.42, spreadX: w * 0.22, spreadY: h * 0.28, baseR: Math.min(w, h) * 0.38 },
            { cx: w * 0.85, cy: h * 0.32, spreadX: w * 0.18, spreadY: h * 0.22, baseR: Math.min(w, h) * 0.32 },
            { cx: w * 0.60, cy: h * 0.55, spreadX: w * 0.20, spreadY: h * 0.25, baseR: Math.min(w, h) * 0.30 },
            { cx: w * 0.78, cy: h * 0.62, spreadX: w * 0.16, spreadY: h * 0.20, baseR: Math.min(w, h) * 0.26 },
          ]
        : [
            { cx: w * 0.65, cy: h * 0.50, spreadX: w * 0.35, spreadY: h * 0.35, baseR: Math.min(w, h) * 0.45 },
            { cx: w * 0.35, cy: h * 0.50, spreadX: w * 0.30, spreadY: h * 0.30, baseR: Math.min(w, h) * 0.40 },
          ];

      const count = preset === 'hero' ? density : Math.floor(density * 0.65);

      for (let i = 0; i < count; i++) {
        const cluster = centers[i % centers.length];
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random();
        
        const x = cluster.cx + Math.cos(angle) * cluster.spreadX * dist;
        const y = cluster.cy + Math.sin(angle) * cluster.spreadY * dist;
        const radius = cluster.baseR * (0.65 + Math.random() * 0.7);

        // Soft alphas for ethereal layering
        const baseAlpha = (0.04 + Math.random() * 0.075) * opacity;
        const colorTones: ('silver' | 'slate' | 'cool')[] = ['silver', 'slate', 'cool'];

        particles.push({
          x,
          y,
          radius,
          baseAlpha,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.18,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.0006 + Math.random() * 0.0009,
          orbitRadius: 10 + Math.random() * 25,
          orbitSpeed: 0.0004 + Math.random() * 0.0006,
          orbitAngle: Math.random() * Math.PI * 2,
          colorTone: colorTones[i % colorTones.length],
        });
      }
    };

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(10, Math.floor(rect.width));
      height = Math.max(10, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      initParticles(width, height);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    handleResize();

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min(time - lastTime, 100);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // Render each soft particle
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          // Floating motion: subtle drift & circular orbit
          p.orbitAngle += p.orbitSpeed * dt;
          const currentX = p.x + Math.cos(p.orbitAngle) * p.orbitRadius;
          const currentY = p.y + Math.sin(p.orbitAngle) * (p.orbitRadius * 0.6);

          p.pulsePhase += p.pulseSpeed * dt;
          const breathing = 0.85 + 0.15 * Math.sin(p.pulsePhase);
          const currentAlpha = p.baseAlpha * breathing;
          const currentRadius = p.radius * (0.95 + 0.05 * Math.sin(p.pulsePhase * 0.8));

          // Draw volumetric puff with smooth falloff
          const grad = ctx.createRadialGradient(
            currentX,
            currentY,
            0,
            currentX,
            currentY,
            currentRadius
          );

          if (p.colorTone === 'silver') {
            grad.addColorStop(0, `rgba(245, 248, 255, ${currentAlpha * 1.2})`);
            grad.addColorStop(0.3, `rgba(220, 230, 245, ${currentAlpha * 0.7})`);
            grad.addColorStop(0.65, `rgba(180, 195, 215, ${currentAlpha * 0.25})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          } else if (p.colorTone === 'slate') {
            grad.addColorStop(0, `rgba(220, 230, 245, ${currentAlpha * 1.1})`);
            grad.addColorStop(0.35, `rgba(175, 190, 210, ${currentAlpha * 0.6})`);
            grad.addColorStop(0.7, `rgba(140, 155, 180, ${currentAlpha * 0.2})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          } else {
            grad.addColorStop(0, `rgba(235, 240, 250, ${currentAlpha * 1.0})`);
            grad.addColorStop(0.4, `rgba(190, 205, 225, ${currentAlpha * 0.5})`);
            grad.addColorStop(0.75, `rgba(150, 170, 195, ${currentAlpha * 0.15})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          }

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(currentX, currentY, currentRadius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Static fallback for prefers-reduced-motion
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          grad.addColorStop(0, `rgba(240, 245, 255, ${p.baseAlpha})`);
          grad.addColorStop(0.4, `rgba(180, 195, 215, ${p.baseAlpha * 0.5})`);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [preset, density, opacity]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      style={{
        maskImage:
          preset === 'hero'
            ? 'radial-gradient(ellipse at 78% 42%, black 20%, transparent 75%)'
            : 'radial-gradient(ellipse at 50% 50%, black 20%, transparent 80%)',
        WebkitMaskImage:
          preset === 'hero'
            ? 'radial-gradient(ellipse at 78% 42%, black 20%, transparent 75%)'
            : 'radial-gradient(ellipse at 50% 50%, black 20%, transparent 80%)',
      }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}

