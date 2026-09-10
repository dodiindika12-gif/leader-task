package id.biz.abskdi.busana;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    private static final String TARGET_URL = "https://task.absgroup.biz.id";

    @Override
    protected void load() {
        super.load();

        Bridge bridge = getBridge();
        if (bridge != null) {
            WebView webView = bridge.getWebView();

            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);

                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                cookieManager.setAcceptThirdPartyCookies(webView, true);

                bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        if (request != null && request.getUrl() != null) {
                            String host = request.getUrl().getHost();
                            // Biarkan Chromium native engine menangani koneksi ke domain server secara langsung.
                            // Ini menghindari bug decoding Brotli/Gzip dari HttpURLConnection bawaan proxy Capacitor.
                            if (host != null && host.contains("absgroup.biz.id")) {
                                return null;
                            }
                        }
                        return super.shouldInterceptRequest(view, request);
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        if (request != null && request.getUrl() != null) {
                            String host = request.getUrl().getHost();
                            // Tetap berada di WebView internal untuk aplikasi dan otentikasi
                            if (host != null && (host.contains("absgroup.biz.id") || host.contains("supabase.co"))) {
                                return false;
                            }
                        }
                        return super.shouldOverrideUrlLoading(view, request);
                    }

                    @Override
                    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                        super.onReceivedError(view, request, error);
                        if (request != null && request.isForMainFrame()) {
                            // Tampilkan halaman offline lokal bila gagal terhubung ke server
                            view.loadUrl("https://localhost/index.html");
                        }
                    }
                });

                // Muat URL produksi langsung dengan custom BridgeWebViewClient aktif
                webView.loadUrl(TARGET_URL);
            }
        }
    }

    @Override
    public void onBackPressed() {
        Bridge bridge = getBridge();
        if (bridge != null && bridge.getWebView() != null && bridge.getWebView().canGoBack()) {
            bridge.getWebView().goBack();
        } else {
            super.onBackPressed();
        }
    }
}
