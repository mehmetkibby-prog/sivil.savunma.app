package com.caglar.sivilsavunma;

import android.app.Activity;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.content.Context;
import android.graphics.Color;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.setStatusBarColor(Color.rgb(23,35,63));
        w.setNavigationBarColor(Color.rgb(23,35,63));
        w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(true);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request != null && request.isForMainFrame()) {
                    Toast.makeText(MainActivity.this, "Sayfa yüklenemedi: " + error.getDescription(), Toast.LENGTH_LONG).show();
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                android.util.Log.e("SivilSavunmaJS",
                        cm.message() + " @" + cm.sourceId() + ":" + cm.lineNumber());
                return true;
            }
        });

        setContentView(webView);
        if (savedInstanceState == null) {
            webView.loadUrl("file:///android_asset/www/index.html");
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override public void onBackPressed() {
        webView.evaluateJavascript(
            "(function(){try{return window.APP&&APP.back?APP.back():false}catch(e){return false}})()",
            value -> {
                if (!"true".equals(value)) {
                    if (webView.canGoBack()) webView.goBack();
                    else super.onBackPressed();
                }
            }
        );
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void vibrate(int ms) {
            Vibrator v = (Vibrator)getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null) return;
            int d = Math.max(8, Math.min(ms, 80));
            if (android.os.Build.VERSION.SDK_INT >= 26)
                v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
            else
                v.vibrate(d);
        }

        @JavascriptInterface
        public void keepScreenOn(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void toast(String text) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, text, Toast.LENGTH_SHORT).show());
        }
    }
}
