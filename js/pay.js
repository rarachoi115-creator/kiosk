/**
 * 결제 화면(pay.html)의 주문 내역 표시, 결제 수단 선택, 2초 모의 결제 진행을 담당합니다.
 */
(function () {
  "use strict";

  const payEmptyView = document.getElementById("pay-empty-view");
  const payMainView = document.getElementById("pay-main-view");
  const payOrderList = document.getElementById("pay-order-list");
  const payTotalCount = document.getElementById("pay-total-count");
  const payTotalPrice = document.getElementById("pay-total-price");

  const methodButtons = Array.prototype.slice.call(
    document.querySelectorAll(".payment-method-btn")
  );
  const paySubmitButton = document.getElementById("pay-submit-button");
  const backToScanButton = document.getElementById("back-to-scan-button");

  const cart = window.createCart();
  const summary = cart.getSummary();

  let selectedMethod = null;
  let isProcessing = false;

  /**
   * 장바구니 상품 목록, 총 수량, 합계를 화면에 표시합니다.
   */
  function renderOrderSummary() {
    if (summary.items.length === 0) {
      payEmptyView.hidden = false;
      payMainView.hidden = true;
      return;
    }

    payEmptyView.hidden = true;
    payMainView.hidden = false;
    payOrderList.innerHTML = "";

    summary.items.forEach(function (item) {
      const row = document.createElement("li");
      row.className = "order-summary-row";

      const nameWrap = document.createElement("div");
      nameWrap.className = "order-item-name-wrap";

      const colorDot = document.createElement("span");
      colorDot.className = "cart-color-dot";
      colorDot.style.backgroundColor = item.color || "#64748b";

      const nameSpan = document.createElement("span");
      nameSpan.className = "order-item-name";
      nameSpan.textContent = item.name;

      nameWrap.appendChild(colorDot);
      nameWrap.appendChild(nameSpan);

      const qtySpan = document.createElement("span");
      qtySpan.className = "order-item-qty";
      qtySpan.textContent = item.quantity + "개";

      const amountSpan = document.createElement("span");
      amountSpan.className = "order-item-amount";
      amountSpan.textContent = window.formatPrice(item.price * item.quantity);

      row.appendChild(nameWrap);
      row.appendChild(qtySpan);
      row.appendChild(amountSpan);
      payOrderList.appendChild(row);
    });

    payTotalCount.textContent = summary.totalCount + "개";
    payTotalPrice.textContent = window.formatPrice(summary.totalPrice);
  }

  /**
   * 결제 수단 버튼 선택 상태를 업데이트합니다.
   * @param {string} method
   */
  function selectPaymentMethod(method) {
    if (isProcessing) {
      return;
    }

    selectedMethod = method;
    methodButtons.forEach(function (btn) {
      const isSelected = btn.getAttribute("data-method") === method;
      btn.classList.toggle("is-selected", isSelected);
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });

    paySubmitButton.disabled = false;
  }

  methodButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectPaymentMethod(btn.getAttribute("data-method"));
    });
  });

  // "상품 더 담기": 장바구니를 유지한 채 계산 화면으로 돌아감
  backToScanButton.addEventListener("click", function () {
    if (isProcessing) {
      return;
    }
    window.location.href = "scan.html";
  });

  // "결제하기": 누르는 순간 영수증을 저장하고 2초 동안 "결제 중..." 표시 뒤 완료 화면으로 이동
  paySubmitButton.addEventListener("click", function () {
    if (!selectedMethod || isProcessing || summary.items.length === 0) {
      return;
    }

    isProcessing = true;
    paySubmitButton.disabled = true;
    paySubmitButton.textContent = "결제 중...";
    backToScanButton.disabled = true;

    methodButtons.forEach(function (btn) {
      btn.disabled = true;
    });

    // 결제하기를 누른 시점의 주문 번호, 결제 시각, 결제 수단, 주문 내역을 저장
    window.createAndSaveReceipt(summary, selectedMethod, new Date());

    window.setTimeout(function () {
      window.location.href = "receipt.html";
    }, 2000);
  });

  renderOrderSummary();
})();
