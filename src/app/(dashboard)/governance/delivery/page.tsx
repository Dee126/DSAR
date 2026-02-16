"use client";

import { useEffect, useState } from "react";

interface DeliverySettingsData {
  defaultExpiresDays: number;
  otpRequiredDefault: boolean;
  maxDownloadsDefault: number;
  logRetentionDays: number;
  allowOneTimeLinks: boolean;
  otpMaxAttempts: number;
  otpLockoutMinutes: number;
  otpExpiryMinutes: number;
}

export default function DeliverySettingsPage() {
  const [settings, setSettings] = useState<DeliverySettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/delivery/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    if (!settings) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await fetch("/api/delivery/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save settings");
      }
      const data = await res.json();
      setSettings(data);
      setSuccess("Settings saved successfully");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Loading delivery settings...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-500">Failed to load settings.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Delivery Portal Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure defaults for secure data delivery links.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
        {/* Link Defaults */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Link Defaults</h3>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Default Expiry (days)
              </label>
              <input
                type="number"
                value={settings.defaultExpiresDays}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultExpiresDays: parseInt(e.target.value) || 7,
                  })
                }
                min={1}
                max={90}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Default Max Downloads
              </label>
              <input
                type="number"
                value={settings.maxDownloadsDefault}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxDownloadsDefault: parseInt(e.target.value) || 3,
                  })
                }
                min={1}
                max={100}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.otpRequiredDefault}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    otpRequiredDefault: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                Require OTP verification by default
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.allowOneTimeLinks}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    allowOneTimeLinks: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                Allow one-time links (max 1 download)
              </span>
            </label>
          </div>
        </div>

        {/* OTP Settings */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900">OTP Settings</h3>
          <div className="mt-3 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Max Attempts
              </label>
              <input
                type="number"
                value={settings.otpMaxAttempts}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    otpMaxAttempts: parseInt(e.target.value) || 5,
                  })
                }
                min={3}
                max={10}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Lockout (minutes)
              </label>
              <input
                type="number"
                value={settings.otpLockoutMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    otpLockoutMinutes: parseInt(e.target.value) || 15,
                  })
                }
                min={5}
                max={60}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">
                OTP Expiry (minutes)
              </label>
              <input
                type="number"
                value={settings.otpExpiryMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    otpExpiryMinutes: parseInt(e.target.value) || 15,
                  })
                }
                min={5}
                max={30}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Retention */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Retention</h3>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-700">
              Log Retention (days)
            </label>
            <input
              type="number"
              value={settings.logRetentionDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  logRetentionDays: parseInt(e.target.value) || 365,
                })
              }
              min={30}
              max={3650}
              className="mt-1 block w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Delivery events and logs older than this will be eligible for cleanup.
            </p>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end border-t border-gray-200 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
