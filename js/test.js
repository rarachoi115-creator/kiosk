/**
 * 인식 테스트 화면(test.html)의 UI 업데이트와 카메라 종료 처리를 담당합니다.
 */
(function () {
  "use strict";

  const videoElement = document.getElementById("webcam-video");
  const cameraPlaceholder = document.getElementById("camera-placeholder");
  const statusElement = document.getElementById("status-message");
  const errorBox = document.getElementById("error-box");
  const errorReason = document.getElementById("error-reason");
  const errorSolution = document.getElementById("error-solution");
  const retryButton = document.getElementById("retry-button");
  const predictionList = document.getElementById("prediction-list");

  // 클래스 이름별로 생성된 DOM 요소(행, 막대, 퍼센트 텍스트)를 저장
  const rowMap = new Map();

  /**
   * 상단 상태 배지 글자와 색상을 업데이트합니다.
   * @param {{ code: string, message: string }} status
   */
  function updateStatus(status) {
    statusElement.textContent = status.message;
    statusElement.classList.remove("is-loading", "is-running", "is-error");

    if (status.code === "running") {
      statusElement.classList.add("is-running");
      cameraPlaceholder.hidden = true;
    } else if (status.code === "error") {
      statusElement.classList.add("is-error");
      cameraPlaceholder.hidden = false;
      cameraPlaceholder.textContent = "카메라를 사용할 수 없습니다";
    } else {
      statusElement.classList.add("is-loading");
      cameraPlaceholder.hidden = false;
      cameraPlaceholder.textContent = status.message;
    }
  }

  /**
   * 오류 안내 영역을 화면에 표시합니다.
   * @param {{ reason: string, solution: string }} errorInfo
   */
  function showError(errorInfo) {
    errorReason.textContent = "이유: " + errorInfo.reason;
    errorSolution.textContent = "해결 방법: " + errorInfo.solution;
    errorBox.hidden = false;
  }

  /**
   * 오류 안내 영역을 숨깁니다.
   */
  function hideError() {
    errorBox.hidden = true;
    errorReason.textContent = "";
    errorSolution.textContent = "";
  }

  /**
   * 모델에서 읽어 온 클래스 이름 목록으로 화면 목록을 한 번에 만듭니다.
   * 코드에 클래스 이름을 직접 적지 않고 모델 메타데이터에서 가져온 목록을 그대로 씁니다.
   * @param {string[]} labels
   */
  function buildPredictionRows(labels) {
    rowMap.clear();
    predictionList.innerHTML = "";

    labels.forEach(function (label) {
      const row = document.createElement("li");
      row.className = "prediction-row";

      const nameSpan = document.createElement("span");
      nameSpan.className = "prediction-label";
      nameSpan.textContent = label;

      const trackDiv = document.createElement("div");
      trackDiv.className = "prediction-bar-track";

      const fillDiv = document.createElement("div");
      fillDiv.className = "prediction-bar-fill";
      trackDiv.appendChild(fillDiv);

      const percentSpan = document.createElement("span");
      percentSpan.className = "prediction-percent";
      percentSpan.textContent = "0%";

      row.appendChild(nameSpan);
      row.appendChild(trackDiv);
      row.appendChild(percentSpan);
      predictionList.appendChild(row);

      rowMap.set(label, {
        row: row,
        fill: fillDiv,
        percent: percentSpan
      });
    });
  }

  /**
   * 예측 결과 목록을 받아 확률 막대와 퍼센트 숫자를 갱신하고
   * 가장 높은 확률을 가진 줄을 강조합니다.
   * @param {Array<{ className: string, probability: number }>} results
   */
  function renderPredictions(results) {
    if (!results || results.length === 0) {
      return;
    }

    // 아직 행이 만들어지지 않았을 때를 대비해 목록을 생성
    if (rowMap.size === 0) {
      buildPredictionRows(
        results.map(function (item) {
          return item.className;
        })
      );
    }

    // 현재 프레임에서 확률이 가장 높은 클래스 찾기
    let topClassName = null;
    let topProbability = -1;

    results.forEach(function (item) {
      if (item.probability > topProbability) {
        topProbability = item.probability;
        topClassName = item.className;
      }
    });

    // 각 클래스 줄의 막대 너비·퍼센트·강조 스타일 업데이트
    results.forEach(function (item) {
      const refs = rowMap.get(item.className);
      if (!refs) {
        return;
      }

      const percentValue = Math.round(item.probability * 100);
      refs.fill.style.width = percentValue + "%";
      refs.percent.textContent = percentValue + "%";

      const isHighest = topProbability > 0 && item.className === topClassName;
      refs.row.classList.toggle("is-top", isHighest);
    });
  }

  // 공용 인식기 생성
  const recognizer = window.createRecognizer({
    videoElement: videoElement,
    modelPath: "./model/",
    facingMode: "user",
    onStatus: updateStatus,
    onLabelsReady: buildPredictionRows,
    onPredict: renderPredictions,
    onError: showError
  });

  function startTest() {
    hideError();
    recognizer.start();
  }

  retryButton.addEventListener("click", startTest);

  // 페이지를 떠나거나 닫을 때 카메라를 확실히 끔 (모바일 Safari 포함)
  window.addEventListener("pagehide", function () {
    recognizer.stop();
  });
  window.addEventListener("beforeunload", function () {
    recognizer.stop();
  });

  // 화면이 열리면 바로 모델 불러오기와 카메라 인식 시작
  startTest();
})();
