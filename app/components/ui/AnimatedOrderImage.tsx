"use client";

import React from "react";
import Image from "next/image";

interface AnimatedOrderImageProps {
    src: string;
    index: number;
}

export default function AnimatedOrderImage({ src, index }: AnimatedOrderImageProps) {
    return (
        <a
            id={`img-link-${index}`}
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            title={`عرض الصورة ${index + 1}`}
            className="relative group block aspect-square rounded-[2rem] overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-500 shadow-lg animate-in fade-in zoom-in-95 duration-700 order-image"
        >
            <style jsx>{`
                .order-image {
                    animation-delay: ${index * 100}ms;
                }
            `}</style>
            <Image
                src={src}
                alt={`Order image ${index + 1}`}
                fill
                loading="lazy"
                className="object-cover group-hover:scale-110 transition-transform duration-1000 blur-[0.2px] group-hover:blur-0"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">المرفق التقني</p>
                <span className="text-xs font-bold text-white uppercase tracking-widest">توسيع العرض 🔍</span>
            </div>
        </a>
    );
}
