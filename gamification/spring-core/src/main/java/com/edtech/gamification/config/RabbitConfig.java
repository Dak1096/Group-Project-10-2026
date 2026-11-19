package com.edtech.gamification.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.*;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Spring sở hữu topology: exchange + durable queue + DLX/DLQ.
 * Queue thật sự durable; message do Node gửi là persistent -> sống sót qua restart broker.
 */
@Configuration
public class RabbitConfig {

    @Value("${app.rabbit.exchange}") private String exchange;
    @Value("${app.rabbit.queue}") private String queue;
    @Value("${app.rabbit.routing-key}") private String routingKey;
    @Value("${app.rabbit.dlx}") private String dlx;
    @Value("${app.rabbit.dlq}") private String dlq;

    @Bean DirectExchange eventsExchange() {
        return ExchangeBuilder.directExchange(exchange).durable(true).build();   // khớp assertExchange bên Node
    }

    @Bean DirectExchange deadLetterExchange() {
        return ExchangeBuilder.directExchange(dlx).durable(true).build();
    }

    @Bean Queue lessonCompletedQueue() {
        return QueueBuilder.durable(queue)
                .withArgument("x-dead-letter-exchange", dlx)
                .withArgument("x-dead-letter-routing-key", dlq)
                .build();
    }

    @Bean Queue lessonCompletedDlq() {
        return QueueBuilder.durable(dlq).build();
    }

    @Bean Binding lessonCompletedBinding() {
        return BindingBuilder.bind(lessonCompletedQueue()).to(eventsExchange()).with(routingKey);
    }

    @Bean Binding dlqBinding() {
        return BindingBuilder.bind(lessonCompletedDlq()).to(deadLetterExchange()).with(dlq);
    }

    /** JSON converter; kiểu đích suy ra từ tham số của @RabbitListener (Node không gửi header __TypeId__). */
    @Bean MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }
}
