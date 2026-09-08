package com.kaffey.pos;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		lockOrientation();
		super.onCreate(savedInstanceState);
	}

	private void lockOrientation() {
		boolean isTablet = getResources().getBoolean(R.bool.is_tablet);
		setRequestedOrientation(
			isTablet
				? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
				: ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
		);
	}
}
