# Gemini Live Studio — Tiếng Việt

[← Tài liệu chính bằng tiếng Anh](../../README.md)

**Gemini Live Studio** là giao diện web chạy cục bộ dành cho Gemini Live API của Google. Bạn có thể trò chuyện bằng giọng nói hoặc văn bản, gửi hình ảnh/khung hình video, theo dõi sự kiện phiên và thử nghiệm function calling.

## Tính năng chính

- Truyền âm thanh microphone theo thời gian thực; phát âm thanh và hiển thị bản chép lời khi API cung cấp.
- Gửi văn bản, tải ảnh lên, chia sẻ khung hình camera, trích khung hình video và truyền tệp âm thanh.
- Chọn mô hình/giọng nói, điều chỉnh tham số tạo sinh và mức suy luận của Extended Thinking.
- Tiếp tục phiên, nén ngữ cảnh, system instruction tùy chỉnh và Google Search tùy chọn.
- Function calling có bước duyệt thủ công; ứng dụng không tự chạy mã tùy ý do mô hình yêu cầu.
- Nhật ký sự kiện, xem/sao chép payload thiết lập, xuất transcript và xuất WAV âm thanh thô để chẩn đoán tiếng bíp/rè.
- Nhiều hồ sơ API key, giao diện tùy biến và cài đặt lưu trong trình duyệt.

## Cài đặt nhanh

1. Cài Node.js 20 trở lên.
2. Tải hoặc clone repository.
3. Trên Windows chạy `start-local.cmd`; hệ điều hành khác chạy `node server.mjs`.
4. Mở **http://127.0.0.1:8765**.
5. Nhập Gemini API key của bạn, chọn mô hình rồi nhấn **Connect session**.
6. Chỉ cấp quyền microphone/camera khi bạn chủ động sử dụng các tính năng đó.

Máy chủ mặc định chỉ lắng nghe trên `127.0.0.1`. Không công khai cổng qua mạng LAN, tunnel hoặc reverse proxy.

## Bảo mật và quyền riêng tư

API key dài hạn được gửi tới máy chủ cục bộ để đổi lấy ephemeral token ngắn hạn, dùng một lần. Key không được đặt trong URL WebSocket Live. Tuy nhiên, hồ sơ key được lưu trong `localStorage` của trình duyệt nếu bật ghi nhớ; đây **không phải kho mã hóa**. Tắt “Remember this key” nếu không muốn lưu key.

Nội dung âm thanh, văn bản, hình ảnh, khung hình video và dữ liệu liên quan đến tool sẽ được gửi tới Google khi sử dụng dịch vụ. Không gửi dữ liệu nhạy cảm nếu chưa đánh giá chính sách và cài đặt tài khoản. Máy chủ chỉ nên dùng trên máy cá nhân, không mở ra mạng không tin cậy.

Cầu nối CLI/skill là tính năng tùy chọn, chỉ cung cấp các thao tác kiểm tra đã cho phép, chỉ đọc và cần người dùng bật, duyệt từng thao tác. Nó không phải shell tổng quát và không tự động thực thi yêu cầu của mô hình.

## Chẩn đoán âm thanh

Nếu âm thanh có tiếng bíp, click hoặc rè, hãy xuất **WAV của âm thanh mô hình gần nhất** tại Settings → Tools và nghe bằng trình phát ngoài. Nếu lỗi có trong WAV, nó đã tồn tại trong dữ liệu âm thanh nhận được. Nếu WAV sạch nhưng phát trực tiếp bị lỗi, hãy kiểm tra lịch phát âm thanh của trình duyệt, buffer, mixer/driver hệ điều hành và thiết bị đầu ra. Điều này chưa đủ để kết luận mô hình nền là nguyên nhân.

## Lưu ý

Bản hiện tại được cấu hình cho `gemini-3.8-live` và `gemini-3.8-live-extended-thinking`; khả năng truy cập phụ thuộc Google. API key, hạn mức, giá và điều khoản do Google quản lý. Dự án độc lập, không liên kết hoặc được Google bảo trợ.

Xem [hướng dẫn chính bằng tiếng Anh](../../README.md), [khả năng công cụ cục bộ](../../LOCAL_AGENT_CAPABILITIES.md) và [giấy phép](../../LICENSE).
