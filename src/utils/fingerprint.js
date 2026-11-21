/**
 * LeakX Discord Game Badges Spoofer
 * Executable fingerprint generator (Node.js Port)
 */

import crypto from 'crypto';
import os from 'os';

export function leakxGenerateFingerprint(userId) {
    /**
     * Generate a deterministic-ish executable fingerprint tied to the user_id
     * and local machine traits. Discord sends this in the `executable_fingerprint`
     * field of game-launch science events.
     *
     * Format: 64-char lowercase hex string (sha256 of composite seed).
     */
    
    // Gather local machine traits using Node.js 'os' module
    let machineId = '0';
    try {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name]) {
                if (net && !net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
                    machineId = parseInt(net.mac.replace(/[:.-]/g, ''), 16).toString();
                    break;
                }
            }
            if (machineId !== '0') break;
        }
    } catch {
        machineId = '123456789';
    }

    const nodeName = os.hostname() || 'localhost';
    const processor = os.arch() || 'x64';
    const osRelease = os.release() || '10.0';

    // Salt using high-resolution time / process uptime
    const saltBuffer = Buffer.alloc(8);
    try {
        const hrTime = process.hrtime();
        saltBuffer.writeDoubleBE(hrTime[0] + hrTime[1] / 1e9, 0);
    } catch {
        saltBuffer.writeDoubleBE(Date.now() / 1000, 0);
    }

    const composite = [
        String(userId),
        String(machineId),
        String(nodeName),
        String(processor),
        String(osRelease),
        saltBuffer.toString('hex'),
    ].join('|');

    return crypto.createHash('sha256').update(composite, 'utf-8').digest('hex');
}

// Compat alias
export const generateFingerprint = leakxGenerateFingerprint;
