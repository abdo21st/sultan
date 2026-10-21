"use client";
import { useEffect } from 'react';

export default function RetireOfflineSupport() {
    useEffect(() => {
        async function retire() {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.filter(registration => [registration.active, registration.waiting, registration.installing].some(worker => worker && new URL(worker.scriptURL).origin === location.origin && new URL(worker.scriptURL).pathname === '/sw.js')).map(registration => registration.unregister()));
            }
            if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.filter(name => name.startsWith('sultan-offline-')).map(name => caches.delete(name)));
            }
            // Remove the auxiliary cache, preserving any old unsent orders.
            if ('indexedDB' in window) indexedDB.deleteDatabase('SultanFacilityCache');
        }
        void retire().catch(() => { console.error('Could not retire a previous offline cache.'); });
    }, []);
    return null;
}
