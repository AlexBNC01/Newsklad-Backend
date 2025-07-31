const nodemailer = require('nodemailer');
const crypto = require('crypto');

class EmailService {
  constructor() {
    // Настройка SMTP транспорта
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Поддержка различных SMTP провайдеров
    const emailConfig = {
      // Gmail SMTP (если используешь Gmail)
      gmail: {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD // App Password для Gmail
        }
      },
      
      // Yandex SMTP (для российских пользователей)
      yandex: {
        host: 'smtp.yandex.ru',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      },
      
      // Mail.ru SMTP
      mailru: {
        host: 'smtp.mail.ru',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      },
      
      // Настраиваемый SMTP
      custom: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      }
    };

    const provider = process.env.EMAIL_PROVIDER || 'custom';
    
    if (emailConfig[provider] && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      this.transporter = nodemailer.createTransporter(emailConfig[provider]);
      console.log('📧 Email сервис инициализирован:', provider);
    } else {
      console.log('⚠️ Email сервис отключен (нет настроек SMTP)');
    }
  }

  // Генерация безопасного кода подтверждения
  generateVerificationCode() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Генерация 6-значного PIN кода
  generatePinCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Отправка email подтверждения регистрации
  async sendVerificationEmail(email, firstName, verificationCode) {
    if (!this.transporter) {
      console.log('📧 Email не отправлен - сервис отключен');
      return { success: false, reason: 'email_disabled' };
    }

    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify?code=${verificationCode}`;
      
      const mailOptions = {
        from: `"Newsklad" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Подтверждение регистрации в Newsklad',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Добро пожаловать в Newsklad!</h2>
            
            <p>Здравствуйте, <strong>${firstName}</strong>!</p>
            
            <p>Спасибо за регистрацию в системе управления складом Newsklad. 
            Для завершения регистрации подтвердите ваш email адрес.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #3498db; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Подтвердить email
              </a>
            </div>
            
            <p>Если кнопка не работает, скопируйте эту ссылку в адресную строку браузера:</p>
            <p style="background-color: #f8f9fa; padding: 10px; border-radius: 3px; word-break: break-all;">
              ${verificationUrl}
            </p>
            
            <hr style="margin: 30px 0;">
            
            <p style="color: #7f8c8d; font-size: 14px;">
              <strong>Важно:</strong> Эта ссылка действительна в течение 24 часов.<br>
              Если вы не регистрировались в Newsklad, просто проигнорируйте это письмо.
            </p>
            
            <p style="color: #7f8c8d; font-size: 12px;">
              С уважением,<br>
              Команда Newsklad
            </p>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email подтверждения отправлен:', email);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      console.error('❌ Ошибка отправки email:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Отправка PIN кода для двухфакторной аутентификации
  async sendPinCode(email, firstName, pinCode) {
    if (!this.transporter) {
      return { success: false, reason: 'email_disabled' };
    }

    try {
      const mailOptions = {
        from: `"Newsklad Security" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Код подтверждения входа - Newsklad',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #e74c3c;">Код подтверждения</h2>
            
            <p>Здравствуйте, <strong>${firstName}</strong>!</p>
            
            <p>Для входа в ваш аккаунт Newsklad введите код подтверждения:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background-color: #f8f9fa; border: 2px solid #e74c3c; 
                          padding: 20px; border-radius: 8px; display: inline-block;">
                <span style="font-size: 32px; font-weight: bold; color: #e74c3c; 
                             letter-spacing: 5px;">${pinCode}</span>
              </div>
            </div>
            
            <p style="color: #7f8c8d; font-size: 14px;">
              <strong>Важно:</strong> Код действителен в течение 10 минут.<br>
              Никому не сообщайте этот код. Если вы не пытались войти в систему, 
              немедленно свяжитесь с поддержкой.
            </p>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 PIN код отправлен:', email);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      console.error('❌ Ошибка отправки PIN:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Проверка готовности email сервиса
  async isReady() {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('❌ Email сервис недоступен:', error.message);
      return false;
    }
  }
}

module.exports = new EmailService();