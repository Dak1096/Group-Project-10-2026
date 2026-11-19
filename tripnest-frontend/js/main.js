const counts = { adults: 2, children: 1, rooms: 1 };
const minValues = { adults: 1, children: 0, rooms: 1 };

function changeCount(type, delta) {
  const next = counts[type] + delta;
  if (next < minValues[type]) return;
  counts[type] = next;
  document.getElementById(type + '-count').textContent = next;
  updateSummary();
}

function updateSummary() {
  const adultLabel = counts.adults === 1 ? 'adult' : 'adults';
  const roomLabel = counts.rooms === 1 ? 'room' : 'rooms';
  let text = counts.adults + ' ' + adultLabel;
  if (counts.children > 0) {
    text += ' · ' + counts.children + (counts.children === 1 ? ' child' : ' children');
  }
  text += ' · ' + counts.rooms + ' ' + roomLabel;
  document.getElementById('occupancy-text').textContent = text;
}

document.getElementById('occupancy-toggle').addEventListener('click', (e) => {
  document.getElementById('occupancy-panel').classList.toggle('hidden');
  e.stopPropagation();
});
document.addEventListener('click', (e) => {
  const panel = document.getElementById('occupancy-panel');
  if (!panel.contains(e.target) && e.target.id !== 'occupancy-toggle') {
    panel.classList.add('hidden');
  }
});



function renderHotels() {
  const container = document.getElementById('hotel-list');
  container.innerHTML = hotels.map(h => `
    <div class="hotel-card">
      <div class="hotel-img-wrap">
        <img src="${h.img}" alt="${h.name}">
        <button class="fav-btn">♡</button>
      </div>
      <div class="hotel-info">
        <h2>${h.name}</h2>
        <div class="stars">${'★'.repeat(h.stars)}${'☆'.repeat(5 - h.stars)}</div>
        ${h.beachfront ? '<div class="badge-thumb">👍 Beachfront</div>' : ''}
        <div class="location-line">
          <a href="#">${h.location}</a> · <a href="#">Show on map</a>
          <span class="dot">•</span>${h.distance}
        </div>
        ${h.tag ? `<div class="tag">${h.tag}</div>` : ''}
        <div class="room-summary">
          <strong>${h.roomType}</strong><br>
          ${h.details}<br>
          ${h.beds}
        </div>
      </div>
      <div class="hotel-price">
        <div class="score-row">
          <div class="score-label">
            <span class="rating-word">${h.rating}</span>
            <span class="review-count">${h.reviews} reviews</span>
          </div>
          <div class="score-box ${h.scoreClass}">${h.score}</div>
        </div>
        <div class="price-block">
          <div class="nights">${h.nights}</div>
          <div class="strike">VND ${h.strikePrice}</div>
          <div class="final">VND ${h.finalPrice}</div>
          <div class="taxes">+ taxes and fees</div>
          <button class="avail-btn">See availability →</button>
        </div>
      </div>
    </div>
  `).join('');
}

renderHotels();
