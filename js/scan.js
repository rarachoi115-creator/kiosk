/**
 * 계산 화면(scan.html)의 카메라 인식, 판정 규칙 연결, 장바구니 화면 갱신을 담당합니다.
 */
(function () {
  "use strict";

  const videoElement = document.getElementById("webcam-video");
  const cameraPlaceholder = document.getElementById("camera-placeholder");
  const addedOverlay = document.getElementById("added-overlay");

  const errorBox = document.getElementById("error-box");
  const errorReason = document.getElementById("error-reason");
  const errorSolution = document.getElementById("error-solution");
  const retryButton = document.getElementById("retry-button");

  const judgeStatusBadge = document.getElementById("judge-status-badge");
  const candidateNameElement = document.getElementById("candidate-name");
  const holdProgressWrap = document.getElementById("hold-progress-wrap");
  const holdProgressFill = document.getElementById("hold-progress-fill");
  const holdProgressText = document.getElementById("hold-progress-text");

  const cartEmpty = document.getElementById("cart-empty");
  const cartList = document.getElementById("cart-list");
  const cartTotalCount = document.getElementById("cart-total-count");
  const cartTotalPrice = document.getElementById("cart-total-price");
  const checkoutButton = document.getElementById("checkout-button");

  // 장바구니 및 판정기 인스턴스 생성
  const cart = window.createCart();
  const judge = window.createJudge();

  let isRecognizerRunning = false;
  let overlayTimerId = null;
  let highlightTimerId = null;
  let highlightedClassName = null;

  /**
   * 장바구니 데이터에 맞춰 장바구니 목록, 합계, 결제하기 버튼 상태를 다시 그립니다.
   */
  function renderCart() {
    const summary = cart.getSummary();
    const hasItems = summary.items.length > 0;

    cartEmpty.hidden = hasItems;
    cartList.hidden = !hasItems;
    cartList.innerHTML = "";

    summary.items.forEach(function (item) {
      const row = document.createElement("li");
      row.className = "cart-row";
      if (highlightedClassName && item.className === highlightedClassName) {
        row.classList.add("is-highlighted");
      }

      const nameWrap = document.createElement("div");
      nameWrap.className = "cart-item-info";

      const colorDot = document.createElement("span");
      colorDot.className = "cart-color-dot";
      colorDot.style.backgroundColor = item.color || "#64748b";

      const nameSpan = document.createElement("span");
      nameSpan.className = "cart-item-name";
      nameSpan.textContent = item.name;

      nameWrap.appendChild(colorDot);
      nameWrap.appendChild(nameSpan);

      const qtySpan = document.createElement("span");
      qtySpan.className = "cart-item-qty";
      qtySpan.textContent = item.quantity + "개";

      const amountSpan = document.createElement("span");
      amountSpan.className = "cart-item-amount";
      amountSpan.textContent = window.formatPrice(item.price * item.quantity);

      row.appendChild(nameWrap);
      row.appendChild(qtySpan);
      row.appendChild(amountSpan);
      cartList.appendChild(row);
    });

    cartTotalCount.textContent = summary.totalCount + "개";
    cartTotalPrice.textContent = window.formatPrice(summary.totalPrice);
    checkoutButton.disabled = !hasItems;
  }

  /**
   * 카메라 영역 위에 "상품이름 담았어요" 안내를 1.5초 동안 크게 띄웁니다.
   * @param {string} productName
   */
  function showAddedOverlay(productName) {
    if (overlayTimerId !== null) {
      window.clearTimeout(overlayTimerId);
      overlayTimerId = null;
    }

    addedOverlay.textContent = productName + " 담았어요";
    addedOverlay.hidden = false;

    overlayTimerId = window.setTimeout(function () {
      addedOverlay.hidden = true;
      addedOverlay.textContent = "";
      overlayTimerId = null;
    }, 1500);
  }

  /**
   * 방금 담긴 상품 줄을 1.5초 동안 잠깐 강조 표시합니다.
   * @param {string} className
   */
  function highlightCartRow(className) {
    if (highlightTimerId !== null) {
      window.clearTimeout(highlightTimerId);
      highlightTimerId = null;
    }

    highlightedClassName = className;
    renderCart();

    highlightTimerId = window.setTimeout(function () {
      highlightedClassName = null;
      renderCart();
      highlightTimerId = null;
    }, 1500);
  }

  /**
   * 진행 막대를 0%로 즉시 비우고 숨깁니다.
   */
  function clearProgressBar() {
    holdProgressWrap.hidden = true;
    holdProgressFill.style.transition = "none";
    holdProgressFill.style.width = "0%";
    holdProgressText.textContent = "0%";
  }

  /**
   * 후보가 있을 때 진행 막대를 0% ~ 100% 로 채워 보여 줍니다.
   * @param {string} productName
   * @param {number} progress
   */
  function showProgressBar(productName, progress) {
    const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
    holdProgressWrap.hidden = false;
    holdProgressFill.style.transition = "width 0.08s linear";
    holdProgressFill.style.width = percent + "%";
    holdProgressText.textContent = percent + "%";
    candidateNameElement.textContent = productName;
    candidateNameElement.hidden = false;
  }

  /**
   * 상태 배지 스타일과 글자를 바꿉니다.
   * @param {string} text
   * @param {"loading"|"running"|"added"|"remove"|"error"} tone
   */
  function setStatusBadge(text, tone) {
    judgeStatusBadge.textContent = text;
    judgeStatusBadge.classList.remove(
      "is-loading",
      "is-running",
      "is-added",
      "is-remove",
      "is-error"
    );

    if (tone === "running") {
      judgeStatusBadge.classList.add("is-running");
    } else if (tone === "added") {
      judgeStatusBadge.classList.add("is-added");
    } else if (tone === "remove") {
      judgeStatusBadge.classList.add("is-remove");
    } else if (tone === "error") {
      judgeStatusBadge.classList.add("is-error");
    } else {
      judgeStatusBadge.classList.add("is-loading");
    }
  }

  /**
   * 모델/카메라 준비 상태를 화면에 반영합니다.
   */
  function handleRecognizerStatus(status) {
    if (status.code === "running") {
      isRecognizerRunning = true;
      cameraPlaceholder.hidden = true;
      setStatusBadge("대기 중 — 상품을 비춰 주세요", "loading");
      clearProgressBar();
      candidateNameElement.hidden = true;
      return;
    }

    isRecognizerRunning = false;
    clearProgressBar();
    candidateNameElement.hidden = true;

    if (status.code === "error") {
      cameraPlaceholder.hidden = false;
      cameraPlaceholder.textContent = "카메라를 사용할 수 없습니다";
      setStatusBadge("실행 오류", "error");
    } else {
      cameraPlaceholder.hidden = false;
      cameraPlaceholder.textContent = status.message;
      setStatusBadge(status.message, "loading");
    }
  }

  /**
   * 예측 결과가 나올 때마다 판정 규칙에 넣고 화면과 장바구니를 갱신합니다.
   * @param {Array<{ className: string, probability: number }>} results
   */
  function handlePredictions(results) {
    if (!isRecognizerRunning) {
      return;
    }

    const decision = judge.evaluate(results, Date.now());

    if (decision.status === "담김" && decision.addedProduct) {
      const added = decision.addedProduct;
      cart.addItem(added);
      showAddedOverlay(added.name);
      highlightCartRow(added.className);
      showProgressBar(added.name, 1);
      setStatusBadge(added.name + " 담김!", "added");
      return;
    }

    if (decision.status === "인식 중" && decision.candidate) {
      showProgressBar(decision.candidate.name, decision.progress);
      setStatusBadge("상품을 잠시 그대로 비춰 주세요", "running");
      return;
    }

    if (decision.status === "치워 주세요") {
      clearProgressBar();
      candidateNameElement.textContent = decision.candidate ? decision.candidate.name : "";
      candidateNameElement.hidden = !decision.candidate;
      setStatusBadge("상품을 치워 주세요", "remove");
      return;
    }

    // 대기 상태(후보가 사라졌거나 기준 미달): 진행 막대를 즉시 비움
    clearProgressBar();
    candidateNameElement.hidden = true;
    setStatusBadge("대기 중 — 상품을 비춰 주세요", "loading");
  }

  function showError(errorInfo) {
    errorReason.textContent = "이유: " + errorInfo.reason;
    errorSolution.textContent = "해결 방법: " + errorInfo.solution;
    errorBox.hidden = false;
  }

  function hideError() {
    errorBox.hidden = true;
    errorReason.textContent = "";
    errorSolution.textContent = "";
  }

  // 공용 인식기 연결
  const recognizer = window.createRecognizer({
    videoElement: videoElement,
    modelPath: "./model/",
    facingMode: "user",
    onStatus: handleRecognizerStatus,
    onPredict: handlePredictions,
    onError: showError
  });

  function startScan() {
    hideError();
    judge.reset();
    clearProgressBar();
    recognizer.start();
  }

  retryButton.addEventListener("click", startScan);

  // 결제하기 버튼은 결제 화면 구현 전까지 눌러도 아무 동작을 하지 않음
  checkoutButton.addEventListener("click", function () {
    // 의도적으로 비워 둠
  });

  // 화면을 떠날 때 카메라 끄기
  window.addEventListener("pagehide", function () {
    recognizer.stop();
  });
  window.addEventListener("beforeunload", function () {
    recognizer.stop();
  });

  // 초기 장바구니 복원(sessionStorage) 및 카메라 인식 시작
  renderCart();
  startScan();
})();
