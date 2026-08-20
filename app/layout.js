export const metadata = {
  title: 'NioPets',
  description: 'Pet travel gear and essentials',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
