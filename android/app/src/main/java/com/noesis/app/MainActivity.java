package com.noesis.app;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null) {
                    fallback();
                    return;
                }
                getBridge().eval("window.dispatchEvent(new Event('noesis:native-back', { cancelable: true }))", result -> {
                    if ("false".equals(result) || isFinishing() || isDestroyed()) return;
                    if (getBridge().getWebView().canGoBack()) getBridge().getWebView().goBack();
                    else fallback();
                });
            }

            private void fallback() {
                setEnabled(false);
                try {
                    getOnBackPressedDispatcher().onBackPressed();
                } finally {
                    setEnabled(true);
                }
            }
        });
    }
}
