'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

const SOURCE_SIZE = 1280;

export default function SigeOwlWave({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const owl = new Image();
    let frame = 0;
    let mounted = true;

    const wingPath = (context: CanvasRenderingContext2D) => {
      context.beginPath();
      context.moveTo(0, 430);
      context.bezierCurveTo(95, 380, 235, 390, 370, 455);
      context.bezierCurveTo(485, 505, 565, 600, 575, 705);
      context.bezierCurveTo(485, 815, 295, 850, 130, 790);
      context.bezierCurveTo(40, 720, 0, 590, 0, 430);
      context.closePath();
    };

    const paint = (time = 0) => {
      if (!mounted) return;
      const ratio = window.devicePixelRatio || 1;
      const cssSize = canvas.clientWidth || 320;
      const pixels = Math.round(cssSize * ratio);
      if (canvas.width !== pixels || canvas.height !== pixels) {
        canvas.width = pixels;
        canvas.height = pixels;
      }
      ctx.setTransform(pixels / SOURCE_SIZE, 0, 0, pixels / SOURCE_SIZE, 0, 0);
      ctx.clearRect(0, 0, SOURCE_SIZE, SOURCE_SIZE);
      ctx.drawImage(owl, 0, 0, SOURCE_SIZE, SOURCE_SIZE);

      if (!reduceMotion) {
        const greeting = Math.sin(time / 230) * Math.PI / 90;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        wingPath(ctx);
        ctx.fill();
        ctx.restore();

        ctx.save();
        wingPath(ctx);
        ctx.clip();
        ctx.translate(500, 560);
        ctx.rotate(greeting);
        ctx.translate(-500, -560);
        ctx.drawImage(owl, 0, 0, SOURCE_SIZE, SOURCE_SIZE);
        ctx.restore();
      }

      frame = requestAnimationFrame(paint);
    };

    owl.onload = () => paint();
    owl.src = '/brand/owl/welcome.png';
    return () => { mounted = false; cancelAnimationFrame(frame); };
  }, [reduceMotion]);

  return (
    <figure className={`sige-owl-wave ${className}`} aria-label="Búho azul de SIGE saludando con el ala">
      <span className="sige-owl-wave__aura" aria-hidden="true" />
      <canvas ref={canvasRef} role="img" aria-label="Búho azul saludando" />
      <span className="sige-owl-wave__shadow" aria-hidden="true" />
    </figure>
  );
}
