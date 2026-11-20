/**
 * 인식 결과를 받아 "지금 이 상품을 장바구니에 담을지" 결정하는 판정 규칙 모듈입니다.
 * 카메라나 화면(DOM) 없이도 예측 결과 목록과 현재 시각(밀리초)만으로 동작합니다.
 */
(function (global) {
  "use strict";

  /**
   * 예측 결과 목록에서 확률이 가장 높은 항목 하나를 찾습니다.
   * @param {Array<{ className: string, probability: number }>} predictions
   * @returns {{ className: string, probability: number } | null}
   */
  function pickTopPrediction(predictions) {
    if (!Array.isArray(predictions) || predictions.length === 0) {
      return null;
    }

    let topItem = null;
    for (let i = 0; i < predictions.length; i += 1) {
      const item = predictions[i];
      if (!item || typeof item.className !== "string" || typeof item.probability !== "number") {
        continue;
      }
      if (!topItem || item.probability > topItem.probability) {
        topItem = item;
      }
    }

    return topItem;
  }

  /**
   * 장바구니 담기 판정기를 생성합니다.
   *
   * @param {Object} [options]
   * @param {Object} [options.config] 판정 기준값 (기본: KIOSK_CONFIG)
   * @param {Function} [options.findProduct] 클래스 이름으로 상품을 찾는 함수 (기본: findProductByClassName)
   * @returns {{ evaluate: Function, reset: Function }}
   */
  function createJudge(options) {
    const opts = options || {};
    const config = Object.assign(
      {
        confidenceThreshold: 0.9,
        holdDurationMs: 1000,
        clearDurationMs: 500,
        emptyClassName: "없음"
      },
      global.KIOSK_CONFIG || {},
      opts.config || {}
    );

    const findProduct =
      typeof opts.findProduct === "function"
        ? opts.findProduct
        : global.findProductByClassName;

    // 현재 유지 시간을 재고 있는 후보 상품 상태
    let candidateClassName = null;
    let candidateStartMs = null;

    // 직전에 장바구니에 담은 상품 이름 (같은 상품 중복 담기 방지용)
    let lastAddedClassName = null;

    // 상품을 치워 후보가 없는 상태가 시작된 시각 (치움 시간 측정용)
    let clearStartMs = null;

    /**
     * 판정기 내부 상태를 초기화합니다.
     */
    function reset() {
      candidateClassName = null;
      candidateStartMs = null;
      lastAddedClassName = null;
      clearStartMs = null;
    }

    /**
     * 규칙 1: 가장 확률이 높은 클래스가 기준 확률 이상이고 가격표에 있는 상품인지 확인합니다.
     * @param {Array<{ className: string, probability: number }>} predictions
     * @returns {{ className: string, name: string, price: number, color: string } | null}
     */
    function findCandidateProduct(predictions) {
      const topItem = pickTopPrediction(predictions);
      if (!topItem) {
        return null;
      }

      if (topItem.className === config.emptyClassName) {
        return null;
      }

      if (topItem.probability < config.confidenceThreshold) {
        return null;
      }

      if (typeof findProduct !== "function") {
        return null;
      }

      return findProduct(topItem.className);
    }

    /**
     * 예측 결과와 현재 시각(밀리초)을 받아 판정 결과를 돌려줍니다.
     *
     * @param {Array<{ className: string, probability: number }>} predictions
     * @param {number} [nowMs=Date.now()]
     * @returns {{
     *   candidate: { className: string, name: string, price: number, color: string } | null,
     *   progress: number,
     *   addedProduct: { className: string, name: string, price: number, color: string } | null,
     *   status: "대기" | "인식 중" | "담김" | "치워 주세요"
     * }}
     */
    function evaluate(predictions, nowMs) {
      const currentTime = typeof nowMs === "number" ? nowMs : Date.now();
      const candidate = findCandidateProduct(predictions);

      // 후보가 없는 상태(없음, 확률 기준 미달, 가격표 미등록 상품)
      if (!candidate) {
        candidateClassName = null;
        candidateStartMs = null;

        // 방금 담은 상품이 있었으면 치움 시간이 지났는지 실제 시각으로 확인
        if (lastAddedClassName !== null) {
          if (clearStartMs === null) {
            clearStartMs = currentTime;
          }
          if (currentTime - clearStartMs >= config.clearDurationMs) {
            lastAddedClassName = null;
            clearStartMs = null;
          }
        }

        return {
          candidate: null,
          progress: 0,
          addedProduct: null,
          status: "대기"
        };
      }

      // 후보가 없는 상태가 치움 시간 이상 이어진 뒤 새 후보가 들어왔다면 잠금 해제
      if (
        lastAddedClassName !== null &&
        clearStartMs !== null &&
        currentTime - clearStartMs >= config.clearDurationMs
      ) {
        lastAddedClassName = null;
        clearStartMs = null;
      }

      // 규칙 3: 방금 담은 것과 같은 상품을 계속 비추고 있으면 다시 담지 않음
      if (candidate.className === lastAddedClassName) {
        clearStartMs = null;
        candidateClassName = null;
        candidateStartMs = null;

        return {
          candidate: candidate,
          progress: 0,
          addedProduct: null,
          status: "치워 주세요"
        };
      }

      // 규칙 4 및 규칙 2: 새로운 후보(또는 처음 인식된 후보)의 유지 시간을 처음부터 측정
      clearStartMs = null;

      if (candidateClassName !== candidate.className) {
        candidateClassName = candidate.className;
        candidateStartMs = currentTime;
      }

      const elapsedMs = Math.max(0, currentTime - candidateStartMs);
      const progress =
        config.holdDurationMs > 0
          ? Math.min(1, elapsedMs / config.holdDurationMs)
          : 1;

      // 유지 시간 이상 이어지면 1번만 담기 판정
      if (elapsedMs >= config.holdDurationMs) {
        lastAddedClassName = candidate.className;
        candidateClassName = null;
        candidateStartMs = null;
        clearStartMs = null;

        return {
          candidate: candidate,
          progress: 1,
          addedProduct: candidate,
          status: "담김"
        };
      }

      return {
        candidate: candidate,
        progress: progress,
        addedProduct: null,
        status: "인식 중"
      };
    }

    return {
      evaluate: evaluate,
      reset: reset
    };
  }

  // 브라우저(window)와 Node.js(globalThis) 양쪽에서 쓸 수 있도록 등록
  global.createJudge = createJudge;
})(typeof window !== "undefined" ? window : globalThis);
