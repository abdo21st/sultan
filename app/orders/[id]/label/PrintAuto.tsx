'use client';
import { useEffect } from "react";

export default function PrintAuto() {
    useEffect(() => {
        window.print();
    }, []);
    return null;
}
