document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('enquiryForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const phone = document.getElementById('phone').value;
      const message = document.getElementById('message').value;

      try {
        const res = await fetch('/api/enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, message })
        });
        const data = await res.json();
        if (data.success) {
          alert('Thank you! Your enquiry has been received.');
          form.reset();
        } else {
          alert('Submission failed: ' + data.error);
        }
      } catch (err) {
        alert('Server error. Please try calling directly.');
      }
    });
  }
});