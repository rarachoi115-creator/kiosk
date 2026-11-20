/**
 * 몽글 마트 무인 계산대의 인식·담기 판정 기준값을 모아 둔 설정 파일입니다.
 * 기준을 바꾸고 싶을 때 이 파일의 숫자만 수정하면 됩니다.
 */
(function (global) {
  "use strict";

  const KIOSK_CONFIG = {
    // 상품 후보로 인정할 최소 확률 (0.9 = 90%)
    confidenceThreshold: 0.9,

    // 같은 상품을 계속 비추었을 때 장바구니에 담기기까지 필요한 유지 시간 (밀리초)
    holdDurationMs: 1000,

    // 상품을 담은 뒤 치웠다고 판단하고 같은 상품을 다시 담을 수 있게 되는 치움 시간 (밀리초)
    clearDurationMs: 500,

    // 카메라 앞에 상품이 없는 상태를 뜻하는 모델 클래스 이름
    emptyClassName: "없음"
  };

  // 브라우저(window)와 Node.js(globalThis) 양쪽에서 쓸 수 있도록 등록
  global.KIOSK_CONFIG = KIOSK_CONFIG;
})(typeof window !== "undefined" ? window : globalThis);
