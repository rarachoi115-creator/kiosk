/**
 * 계산 화면(scan.html)의 카메라 인식, 직접 담기, 장바구니 수량/삭제/비우기 제어를 담당합니다.
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

  const manualProductList = document.getElementById("manual-product-list");

  const clearCartButton = document.getElementById("clear-cart-button");
  const clearConfirmBox = document.getElementById("clear-confirm-box");
  const clearCancelButton = document.getElementById("clear-cancel-button");
  const clearConfirmButton = document.getElementById("clear-confirm-button");

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
   * 장바구니 전체 비우기 확인창을 숨깁니다.
   */
  function hideClearConfirm() {
    clearConfirmBox.hidden = true;
  }

  /**
   * 장바구니 데이터에 맞춰 목록, 수량/삭제 버튼, 전체 비우기 버튼, 합계, 결제하기 버튼을 다시 그립니다.
   */
  function renderCart() {
    const summary = cart.getSummary();
    const hasItems = summary.items.length > 0;

    cartEmpty.hidden = hasItems;
    cartList.hidden = !hasItems;
    clearCartButton.hidden = !hasItems;

    if (!hasItems) {
      hideClearConfirm();
    }

    cartList.innerHTML = "";

    summary.items.forEach(function (item) {
      const row = document.createElement("li");
      row.className = "cart-row";
      if (highlightedClassName && item.className === highlightedClassName) {
        row.classList.add("is-highlighted");
      }

      // 윗줄: 상품 색상 점 + 이름 / 금액(가격 × 수량)
      const topRow = document.createElement("div");
      topRow.className = "cart-row-top";

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

      const amountSpan = document.createElement("span");
      amountSpan.className = "cart-item-amount";
      amountSpan.textContent = window.formatPrice(item.price * item.quantity);

      topRow.appendChild(nameWrap);
      topRow.appendChild(amountSpan);

      // 아랫줄: 수량 조절 버튼(−, 수량, +) / 삭제 버튼
      const controlsRow = document.createElement("div");
      controlsRow.className = "cart-row-controls";

      const qtyStepper = document.createElement("div");
      qtyStepper.className = "cart-qty-stepper";

      const decreaseBtn = document.createElement("button");
      decreaseBtn.type = "button";
      decreaseBtn.className = "qty-btn";
      decreaseBtn.textContent = "−";
      decreaseBtn.setAttribute("aria-label", item.name + " 수량 줄이기");
      decreaseBtn.addEventListener("click", function () {
        cart.decreaseItem(item.className);
        hideClearConfirm();
        renderCart();
      });

      const qtySpan = document.createElement("span");
      qtySpan.className = "cart-item-qty";
      qtySpan.textContent = item.quantity + "개";

      const increaseBtn = document.createElement("button");
      increaseBtn.type = "button";
      increaseBtn.className = "qty-btn";
      increaseBtn.textContent = "+";
      increaseBtn.setAttribute("aria-label", item.name + " 수량 늘리기");
      increaseBtn.addEventListener("click", function () {
        cart.increaseItem(item.className);
        hideClearConfirm();
        renderCart();
      });

      qtyStepper.appendChild(decreaseBtn);
      qtyStepper.appendChild(qtySpan);
      qtyStepper.appendChild(increaseBtn);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-item-button";
      removeBtn.textContent = "삭제";
      removeBtn.setAttribute("aria-label", item.name + " 삭제");
      removeBtn.addEventListener("click", function () {
        cart.removeItem(item.className);
        hideClearConfirm();
        renderCart();
      });

      controlsRow.appendChild(qtyStepper);
      controlsRow.appendChild(removeBtn);

      row.appendChild(topRow);
      row.appendChild(controlsRow);
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
   * 상품을 장바구니에 1개 담고 화면 안내와 강조 표시를 함께 실행합니다.
   * (카메라 인식 담기와 직접 담기 버튼 양쪽에서 공통으로 사용)
   * @param {{ className: string, name: string, price: number, color?: string }} product
   */
  function addProductWithFeedback(product) {
    if (!product) {
      return;
    }

    cart.addItem(product);
    hideClearConfirm();
    showAddedOverlay(product.name);
    highlightCartRow(product.className);
  }

  /**
   * 가격표(PRODUCTS)를 읽어 "직접 담기" 상품 버튼 목록을 만듭니다.
   */
  function renderManualProducts() {
    manualProductList.innerHTML = "";
    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];

    products.forEach(function (product) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "manual-product-btn";

      const titleWrap = document.createElement("span");
      titleWrap.className = "manual-product-title";

      const colorDot = document.createElement("span");
      colorDot.className = "cart-color-dot";
      colorDot.style.backgroundColor = product.color || "#64748b";

      const nameSpan = document.createElement("span");
      nameSpan.className = "manual-product-name";
      nameSpan.textContent = product.name;

      titleWrap.appendChild(colorDot);
      titleWrap.appendChild(nameSpan);

      const priceSpan = document.createElement("span");
      priceSpan.className = "manual-product-price";
      priceSpan.textContent = window.formatPrice(product.price);

      btn.appendChild(titleWrap);
      btn.appendChild(priceSpan);

      btn.addEventListener("click", function () {
        addProductWithFeedback(product);
      });

      manualProductList.appendChild(btn);
    });
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
      addProductWithFeedback(added);
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

  // 전체 비우기 버튼 클릭 시 확인 문구 표시
  clearCartButton.addEventListener("click", function () {
    clearConfirmBox.hidden = false;
  });

  clearCancelButton.addEventListener("click", function () {
    hideClearConfirm();
  });

  clearConfirmButton.addEventListener("click", function () {
    highlightedClassName = null;
    cart.clear();
    hideClearConfirm();
    renderCart();
  });

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

  // 결제하기 버튼을 누르면 장바구니가 비어 있지 않을 때 결제 화면으로 이동
  checkoutButton.addEventListener("click", function () {
    if (cart.getSummary().items.length === 0) {
      return;
    }
    window.location.href = "pay.html";
  });

  // 화면을 떠날 때 카메라 끄기
  window.addEventListener("pagehide", function () {
    recognizer.stop();
  });
  window.addEventListener("beforeunload", function () {
    recognizer.stop();
  });

  // 초기 직접 담기 버튼 생성, 장바구니 복원(sessionStorage) 및 카메라 인식 시작
  renderManualProducts();
  renderCart();
  startScan();
})();
