<script setup lang="ts">
import axios from "axios"
import {ref} from 'vue'

const sheetUrl = ref('')
const isProcessing = ref(false);
const options = ref({
  simplePalette: false,
  d20roll: false,
})

const checkUrl = () => {
  if(sheetUrl.value === "") {
    return "URLが入力されていません。"
  }
  const pattern = /^https:\/\/dndjp\.sakura\.ne\.jp\/OUTPUT\.php\?ID=\d+$/;
  if(!pattern.test(sheetUrl.value)) {
    return "URLの形式が正しくありません。"
  }
  return "";
}

const onSubmit = async () => {
  const checkUrlResult = checkUrl();
  if(checkUrlResult !== "") {
    alert(checkUrlResult);
    return;
  }
  if(isProcessing.value) {
    alert("生成処理中です")
  }
  try {
    isProcessing.value = true;
    // const response = await axios.get("https://generatezipfile-nrgupttyta-an.a.run.app",{
    const response = await axios.get(import.meta.env.VITE_API_URL ,{
      params: {
        url: sheetUrl.value,
        simple_palette: options.value.simplePalette,
        rollcommand: options.value.d20roll ? "default" : null
      },
      responseType: 'blob' 
    })
    if (response.status === 200 && response.data) {
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'data.zip'; // デフォルトのファイル名
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*=UTF\-8''"(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
      a.download = decodeURIComponent(filename); 
      document.body.appendChild(a); 
      a.click(); 
      document.body.removeChild(a); 
      URL.revokeObjectURL(url); 
      console.log("ファイル生成完了")
    } else {
      alert("APIでエラーが発生しました。")
      console.error("APIでエラーが発生しました。", response)
    }
  } catch(e) {
    alert("エラーが発生しました。")
    console.error("エラーが発生しました。", e)
  } finally {
    isProcessing.value = false;
  }
}
</script>

<template>
  <div class="main">
    <div class="container">
      <h1>D&D5e ユドナリウムPCコマ生成ツール</h1>
      <p class="lead">
        <a href="https://dndjp.sakura.ne.jp/LIST.php">https://dndjp.sakura.ne.jp/LIST.php</a>で作成したキャラクターシートから、ユドナリウム用のコマを生成します。
        <br>
        つくった人→<a href="https://x.com/butter_uni">うにバター</a>
      </p>
      <input class="input" type="text" v-model="sheetUrl" placeholder="https://dndjp.sakura.ne.jp/OUTPUT.php?ID=XXXXX">
      <button class="button" @click="onSubmit" :disabled="isProcessing">
        {{isProcessing ? "ちょっとまってね" : "生成する"}}
      </button>
      <div class="options">
        <label class="checkBox">
          <input type="checkbox" v-model="options.d20roll">
          <div>チャットパレットのダイスロールコマンドを1d20にする</div>
        </label>
        <label class="checkBox">
          <input type="checkbox" v-model="options.simplePalette">
          <div>チャットパレットの判定修正値を数値にする</div>
        </label>
      </div>
      <div>
        <h2>ごちゅうい</h2>
        <ul class="notes">
          <li>キャラクター画像は取り込みません。</li>
          <li>チャットパレットには変数参照を使用しているため、コマの能力値が変動した際に一部を除いてチャットパレットを修正せずに済みます。<br>一方でチャットパレット上で実際の修正値が確認しづらいため、変数参照が不要な場合は「チャットパレットの判定修正値を数値にする」をONにして生成してください。</li>
        </ul>
      </div>
      <div>
        <h2>更新履歴</h2>
        <ul class="updates">
          <li>v1.1.1 ダイスロールコマンドを1d20とAR/ATから選択できるように</li>
          <li>v1.1.0 ダイスロールコマンドを1d20からAR/ATに変更</li>
          <li>v1.0.0 リリース</li>
        </ul>
      </div>

    </div>

  </div>
</template>

<style scoped>
  .container {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: 1fr;
    /* justify-content: center;
    align-items: center;
    flex-direction: column; */
    justify-content: center;
    gap: 20px;
    font-size: 20px;
  }
  h1 {
    font-family: "Dela Gothic One", sans-serif;
    font-weight: 400;
    font-style: normal;
    text-align: center;
  }
  h2 {
    font-weight: bold;
    font-size: 20px;
    text-align: left;
  }
  .input {
    font-size: 28px;
    width: 100%;
    text-align: center;
    padding: 10px;
    border-radius: 10px;
  }
  .lead {
    text-align: center;
  }
  .notes {
    width: 100%;
    font-size: 14px;
  }
  .updates {
    width: 100%;
    font-size: 14px;
  }
  .checkBox {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: center;
  }
  .checkBox input {
    display: none;
  }
  .checkBox::before {
    content: "";
    display: block;
    width: 1.5em;
    height: 1.5em;
    border-radius: 5px;
    border: solid 2px hsla(160, 100%, 37%, 1);
  }
  .checkBox:has(input:checked)::before {
    background-color: hsla(160, 100%, 37%, 1);
    background-image: url("data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJfeDMyXyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBzdHlsZT0id2lkdGg6IDEyOHB4OyBoZWlnaHQ6IDEyOHB4OyBvcGFjaXR5OiAxOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHN0eWxlIHR5cGU9InRleHQvY3NzIj4JLnN0MHtmaWxsOiM0QjRCNEI7fTwvc3R5bGU+PGc+CTxwb2x5Z29uIGNsYXNzPSJzdDAiIHBvaW50cz0iNDQwLjQ2OSw3My40MTMgMjE4LjM1NywyOTUuNTI1IDcxLjUzMSwxNDguNzA5IDAsMjIwLjIyOSAxNDYuODI2LDM2Ny4wNTUgMjE4LjM1Nyw0MzguNTg3IDI4OS44NzgsMzY3LjA1NSA1MTIsMTQ0Ljk0NSAiIHN0eWxlPSJmaWxsOiByZ2IoMjU1LCAyNTUsIDI1NSk7Ij48L3BvbHlnb24+PC9nPjwvc3ZnPg==");
    background-size: 1em;
    background-position: center center;
    background-repeat: no-repeat;
  }
  .button {
    padding: 10px 40px;
    background-color: #fff;
    border: solid 2px hsla(160, 100%, 37%, 1);
    background-color: hsla(160, 100%, 37%, 1);
    color: #fff;
    font-size: 20px;
    border-radius: 10px;
    cursor: pointer;
    width: 300px;
    margin: auto;
  }
  .button:disabled {
    filter: grayscale(1);
  }
  .options {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    width: 600px;
    margin: auto;
  }

</style>
