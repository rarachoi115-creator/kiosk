/**
 * 결제 주문 번호 생성(localStorage 일별 순번)과
 * 결제 완료 영수증 저장·불러오기(sessionStorage)를 담당하는 모듈입니다.
 */
(function (global) {
  "use strict";

  const ORDER_COUNTER_KEY = "mongle_mart_order_counter";
  const RECEIPT_STORAGE_KEY = "mongle_mart_receipt";

  /**
   * 숫자를 2자리 문자열(예: 5 -> "05")로 맞춥니다.
   * @param {number} num
   * @returns {string}
   */
  function pad2(num) {
    return String(num).padStart(2, "0");
  }

  /**
   * 날짜 비교용 문자열(YYYY-MM-DD)을 만듭니다.
   * @param {Date} date
   * @returns {string}
   */
  function formatDateKey(date) {
    return (
      date.getFullYear() +
      "-" +
      pad2(date.getMonth() + 1) +
      "-" +
      pad2(date.getDate())
    );
  }

  /**
   * 주문 번호 앞부분(MMDD, 예: 1119)을 만듭니다.
   * @param {Date} date
   * @returns {string}
   */
  function formatShortDate(date) {
    return pad2(date.getMonth() + 1) + pad2(date.getDate());
  }

  /**
   * 영수증에 표시할 결제 시각(YYYY.MM.DD HH:mm)을 만듭니다.
   * @param {Date} date
   * @returns {string}
   */
  function formatPaidAt(date) {
    return (
      date.getFullYear() +
      "." +
      pad2(date.getMonth() + 1) +
      "." +
      pad2(date.getDate()) +
      " " +
      pad2(date.getHours()) +
      ":" +
      pad2(date.getMinutes())
    );
  }

  /**
   * 오늘 날짜와 순번으로 주문 번호(예: 1119-001)를 생성합니다.
   * 순번은 localStorage에 저장되어 결제할 때마다 1씩 늘어나며,
   * 날짜가 바뀌면 001부터 다시 시작합니다.
   *
   * @param {Date} [now=new Date()]
   * @returns {string}
   */
  function generateNextOrderNumber(now) {
    const currentDate = now instanceof Date ? now : new Date();
    const dateKey = formatDateKey(currentDate);
    let nextSeq = 1;

    if (global.localStorage) {
      try {
        const raw = global.localStorage.getItem(ORDER_COUNTER_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            parsed &&
            parsed.date === dateKey &&
            typeof parsed.seq === "number" &&
            Number.isFinite(parsed.seq) &&
            parsed.seq >= 1
          ) {
            nextSeq = Math.floor(parsed.seq) + 1;
          }
        }
        global.localStorage.setItem(
          ORDER_COUNTER_KEY,
          JSON.stringify({ date: dateKey, seq: nextSeq })
        );
      } catch (err) {
        console.warn("주문 번호 저장 실패:", err);
      }
    }

    return formatShortDate(currentDate) + "-" + String(nextSeq).padStart(3, "0");
  }

  /**
   * 영수증 데이터를 sessionStorage에 저장합니다.
   * @param {Object} receipt
   */
  function saveReceipt(receipt) {
    if (!global.sessionStorage) {
      return;
    }

    try {
      global.sessionStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
    } catch (err) {
      console.warn("영수증 저장 실패:", err);
    }
  }

  /**
   * 결제하기를 누르는 순간 장바구니 내용으로 영수증을 만들어 저장합니다.
   *
   * @param {{ items: Array, totalCount: number, totalPrice: number }} summary
   * @param {string} paymentMethod
   * @param {Date} [now=new Date()]
   * @returns {Object}
   */
  function createAndSaveReceipt(summary, paymentMethod, now) {
    const currentDate = now instanceof Date ? now : new Date();
    const items = Array.isArray(summary && summary.items)
      ? summary.items.map(function (item) {
          return {
            className: item.className,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            color: item.color || "#64748b"
          };
        })
      : [];

    const receipt = {
      orderNumber: generateNextOrderNumber(currentDate),
      paidAt: formatPaidAt(currentDate),
      paymentMethod: paymentMethod,
      items: items,
      totalCount: Number(summary && summary.totalCount) || 0,
      totalPrice: Number(summary && summary.totalPrice) || 0
    };

    saveReceipt(receipt);
    return receipt;
  }

  /**
   * sessionStorage에서 저장된 영수증을 읽어 옵니다. 없으면 null을 돌려줍니다.
   * @returns {Object | null}
   */
  function loadReceipt() {
    if (!global.sessionStorage) {
      return null;
    }

    try {
      const raw = global.sessionStorage.getItem(RECEIPT_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed.orderNumber !== "string" ||
        typeof parsed.paidAt !== "string" ||
        typeof parsed.paymentMethod !== "string" ||
        !Array.isArray(parsed.items)
      ) {
        return null;
      }

      return parsed;
    } catch (err) {
      console.warn("영수증 불러오기 실패:", err);
      return null;
    }
  }

  /**
   * 저장된 영수증을 sessionStorage에서 지웁니다.
   */
  function clearReceipt() {
    if (!global.sessionStorage) {
      return;
    }

    try {
      global.sessionStorage.removeItem(RECEIPT_STORAGE_KEY);
    } catch (err) {
      console.warn("영수증 삭제 실패:", err);
    }
  }

  // 브라우저(window)와 Node.js(globalThis) 양쪽에서 쓸 수 있도록 등록
  global.createAndSaveReceipt = createAndSaveReceipt;
  global.loadReceipt = loadReceipt;
  global.clearReceipt = clearReceipt;
  global.formatPaidAt = formatPaidAt;
  global.generateNextOrderNumber = generateNextOrderNumber;
})(typeof window !== "undefined" ? window : globalThis);
