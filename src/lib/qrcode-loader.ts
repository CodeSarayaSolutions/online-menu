declare global {
  interface Window {
    QRCode?: new (
      el: HTMLElement,
      options: { text: string; width?: number; height?: number; colorDark?: string; colorLight?: string }
    ) => void;
  }
}

let loadPromise: Promise<void> | null = null;

export function loadQrCodeScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.QRCode) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      script.remove();
      reject(new Error("Failed to load QR code library"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function renderQrCode(el: HTMLElement, text: string, size = 220) {
  if (!window.QRCode) throw new Error("QRCode library not loaded");
  el.innerHTML = "";
  new window.QRCode(el, {
    text,
    width: size,
    height: size,
    colorDark: "#1E1E1E",
    colorLight: "#FFFFFF",
  });
}

export function qrCanvasFromContainer(container: HTMLElement): HTMLCanvasElement | null {
  return container.querySelector("canvas");
}
