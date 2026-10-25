export const BUSINESS_ANSWER_NOTICE =
  'Yanıtlar markanın paylaştığı bilgiler temel alınarak yapay zekâ tarafından oluşturulur. Güncel ve kesin bilgiler için markayla iletişime geçebilirsiniz.';

/** Fixed under the Business Yansı composer. Not part of any message. */
export default function BusinessAnswerNotice() {
  return (
    <p className="saina-business-answer-note" data-testid="business-answer-note">
      {BUSINESS_ANSWER_NOTICE}
    </p>
  );
}
